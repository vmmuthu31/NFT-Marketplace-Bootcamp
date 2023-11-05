import React, { useState, useRef } from 'react';
import { useFormik } from 'formik';
import * as yup from 'yup';
import {
  Box,
  Grid,
  TextField,
  Typography,
  IconButton,
  Collapse,
  Alert,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import DialogBox from 'components/DialogBox';

import web3 from 'web3';
import Web3Modal from 'web3modal';
import { ethers } from 'ethers';
import { create } from 'ipfs-http-client';
import Marketplace from 'contracts/Marketplace.sol/Marketplace.json';

const validationSchema = yup.object({
  name: yup
    .string()
    .trim()
    .min(2, 'Name too short')
    .max(50, 'Name too long')
    .required('Please specify the name'),
  description: yup
    .string()
    .trim()
    .max(1000, 'Should be less than 1000 chars')
    .required('Please write description'),
  price: yup
    .string()
    .min(0, 'Price should be minimum 0')
    .required('Please specify NFT price'),
  address: yup
    .string()
    .min(0, 'Price should be minimum 3')
    .matches(
      /((https?):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/,
      'Enter correct url!',
    ),
});

const Form = () => {
  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
      price: '',
      address: '',
    },
    validationSchema: validationSchema,
    onSubmit: (values) => {
      setLoading(true);
      createMarket();
    },
  });

  const [open, setOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [loading, setLoading] = React.useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [dialogBoxOpen, setDialogBoxOpen] = useState(false);
  const [hash, setHash] = useState('');
  const fileInputRef = useRef(null);

  const projectId = 'Media-dapp';
  const projectSecret = '5354a7f58c55460e8b48fbcbe9c7214e';
  const infuraDomain =
    'https://polygon-mumbai.infura.io/v3/57df90d6aba449359ddb768dd5fa36d0';

  const auth =
    'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');

  const client = create({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https',
    headers: {
      authorization: auth,
    },
  });

  async function createSale(url) {
    if (fileUrl) {
      const web3Modal = new Web3Modal({
        network: 'testnet',
        cacheProvider: true,
      });
      const connection = await web3Modal.connect();
      const provider = new ethers.providers.Web3Provider(connection);
      const signer = provider.getSigner();

      const price = web3.utils.toWei(formik.values.price, 'ether');
      let contract = new ethers.Contract(
        '0x47DbCB700A3C9b9Ec0685d854a54b1336DB926dB',
        Marketplace.abi,
        signer,
      );
      let listingPrice = await contract.getListingPrice();
      listingPrice = listingPrice.toString();
      let transaction = await contract.createToken(url, price, {
        value: listingPrice,
      });

      try {
        await transaction.wait();
        setHash(transaction.hash);
        setDialogBoxOpen(true);
      } catch (error) {
        alert('Error in creating NFT! Please try again.');
        setLoading(false);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // clear the file input
      }
      setAlertOpen(false);
      formik.resetForm();
      console.log(fileUrl);
      setLoading(false);
    }

    if (!fileUrl) return setAlertOpen(true);
  }

  async function uploadToPinata(file, pinataApiKey, pinataSecretApiKey) {
    const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

    // We need to send a multipart request with the file
    let data = new FormData();
    data.append('file', file);

    // Pinata requires the request to have the headers 'pinata_api_key' and 'pinata_secret_api_key'
    const headers = {
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataSecretApiKey,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: data,
    });

    if (!response.ok) {
      throw new Error(`IPFS pinning error: ${response.statusText}`);
    }

    return response.json(); // the response will include the IPFS hash
  }

  // Function to handle file input change
  async function onChange(e) {
    const file = e.target.files[0];
    setLoading(true);

    try {
      const result = await uploadToPinata(
        file,
        '66b871c91c1137d97b82',
        '71ad43206bd6b413d1bdcb0d839e3cc52f09591f1940e7bddefc4fe1947d335f',
      );
      const url = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
      setFileUrl(url);
      console.log(url);
      setOpen(true);
    } catch (error) {
      console.log('Error uploading file to Pinata: ', error);
    } finally {
      setLoading(false);
    }
  }

  async function createMarket() {
    const { name, description, price, address } = formik.values;
    if (!name || !description || !price || !fileUrl) {
      console.log('All fields are required.');
      return;
    }

    const metadata = {
      name,
      description,
      address,
      image: fileUrl,
    };

    try {
      const metadataFile = new Blob([JSON.stringify(metadata)], {
        type: 'application/json',
      });
      const pinataApiKey = '66b871c91c1137d97b82';
      const pinataSecretApiKey =
        '71ad43206bd6b413d1bdcb0d839e3cc52f09591f1940e7bddefc4fe1947d335f';
      const result = await uploadToPinata(
        metadataFile,
        pinataApiKey,
        pinataSecretApiKey,
      );
      const url = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
      await createSale(url);
    } catch (error) {
      console.error('Error uploading metadata to Pinata: ', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      <form onSubmit={formik.handleSubmit}>
        <Grid container spacing={4}>
          <Grid item xs={12} sm={6}>
            <Typography
              variant={'subtitle2'}
              sx={{ marginBottom: 2, display: 'flex', alignItems: 'center' }}
              fontWeight={700}
            >
              <AttachFileIcon fontSize="medium" />
              Upload file *
            </Typography>
            <input
              type="file"
              name={'file'}
              onChange={onChange}
              ref={fileInputRef}
            />
            <Collapse in={open}>
              <Alert
                severity="success"
                sx={{ mt: 1 }}
                action={
                  <IconButton
                    aria-label="close"
                    color="inherit"
                    size="small"
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                }
              >
                File uploaded successfully!
              </Alert>
            </Collapse>
            <Box sx={{ width: '100%' }}>
              <Collapse in={alertOpen}>
                <Alert
                  severity="error"
                  action={
                    <IconButton
                      aria-label="close"
                      color="inherit"
                      size="small"
                      onClick={() => {
                        setAlertOpen(false);
                      }}
                    >
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  }
                  sx={{ mb: 2 }}
                >
                  Please upload a file!
                </Alert>
              </Collapse>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography
              variant={'subtitle2'}
              sx={{ marginBottom: 2 }}
              fontWeight={700}
            >
              NFT Name
            </Typography>
            <TextField
              label="Name of your NFT *"
              variant="outlined"
              name={'name'}
              fullWidth
              onChange={formik.handleChange}
              value={formik.values?.name}
              error={formik.touched.name && Boolean(formik.errors.name)}
              helperText={formik.touched.name && formik.errors.name}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography
              variant={'subtitle2'}
              sx={{ marginBottom: 2 }}
              fontWeight={700}
            >
              Description
            </Typography>
            <TextField
              label="Description *"
              variant="outlined"
              name={'description'}
              multiline
              rows={3}
              fullWidth
              onChange={formik.handleChange}
              value={formik.values?.description}
              error={
                formik.touched.description && Boolean(formik.errors.description)
              }
              helperText={
                formik.touched.description && formik.errors.description
              }
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography
              variant={'subtitle2'}
              sx={{ marginBottom: 2 }}
              fontWeight={700}
            >
              Price
            </Typography>
            <TextField
              label="Price in Matic *"
              variant="outlined"
              name={'price'}
              fullWidth
              onChange={formik.handleChange}
              value={formik.values?.price}
              error={formik.touched.price && Boolean(formik.errors.price)}
              helperText={formik.touched.price && formik.errors.price}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography
              variant={'subtitle2'}
              sx={{ marginBottom: 2 }}
              fontWeight={700}
            >
              Link
            </Typography>
            <TextField
              label="Link to your NFT"
              variant="outlined"
              name={'address'}
              fullWidth
              onChange={formik.handleChange}
              value={formik.values?.address}
              error={formik.touched.address && Boolean(formik.errors.address)}
              helperText={formik.touched.address && formik.errors.address}
            />
          </Grid>
          <Grid item container xs={12}>
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretched', sm: 'center' }}
              justifyContent={'space-between'}
              width={1}
              margin={'0 auto'}
            >
              <LoadingButton
                endIcon={<SendIcon />}
                size={'large'}
                variant={'contained'}
                type={'submit'}
                loading={loading}
                loadingPosition={'end'}
              >
                Create
              </LoadingButton>
            </Box>
          </Grid>
        </Grid>
      </form>
      <DialogBox
        open={dialogBoxOpen}
        onClose={() => setDialogBoxOpen(false)}
        title={'Yeee!'}
        message={`NFT created successfully with hash: ${hash}`}
        buttonText="View on polygonscan"
        buttonLink={`https://mumbai.polygonscan.com/tx/${hash}`}
      />
    </Box>
  );
};

export default Form;
