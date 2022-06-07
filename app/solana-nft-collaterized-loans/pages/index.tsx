import type {NextPage} from 'next'
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import {useAnchorWallet} from "@solana/wallet-adapter-react";
import {useEffect, useState} from "react";
import {useProgram} from "../utils/usePrograms";
import * as anchor from "@project-serum/anchor";
import {cancelOrder, createOrder, getOrders, liquidity, loanOrder, payBack} from "../services/service";
import {Alert, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, Grid, Snackbar, Stack, TextField, Typography} from "@mui/material";
import {Order} from "../src/Models/Order";
import {styled} from "@mui/material/styles";
import LoadingButton from "@mui/lab/LoadingButton";
import * as React from "react";
import {STABLE_COIN_KEY} from "../utils/consts";
import {SnackbarProvider, VariantType, useSnackbar} from 'notistack';
import NFTImage from "../components/NFTImage";

//const endpoint = "https://explorer-api.devnet.solana.com";
const endpoint = "https://api.devnet.solana.com";

const connection = new anchor.web3.Connection(endpoint);

const LabelValueTypography = styled(Typography)({
    color: "#4CDC8F",
    fontSize: "14px",
});

const SpanValueTypography = styled(Typography)({
    color: "#333333",
    fontSize: "14px",
});

const Home: NextPage = () => {
    const {enqueueSnackbar} = useSnackbar();
    const wallet: any = useAnchorWallet();
    const [orders, setOrders] = useState<Order[]>([]);
    const {program} = useProgram({connection, wallet});
    const [lastUpdatedTime, setLastUpdatedTime] = useState<number>();

    // Create Order
    const [open, setOpen] = React.useState(false);
    const [nft, setNft] = React.useState('');
    const [createLoading, setCreateLoading] = React.useState(false);
    const [cancelLoading, setCancelLoading] = React.useState(false);
    const [loanLoading, setLoanLoading] = React.useState(false);
    const [paybackLoading, setPaybackLoading] = React.useState(false);
    const [liquidityLoading, setLiquidityLoading] = React.useState(false);

    const [usdc, setUsdc] = React.useState('--');

    useEffect(() => {
        fetchOrders();
        fetchUSDCBalance();
    }, [wallet, lastUpdatedTime]);

    const fetchOrders = async () => {
        if (wallet && program) {
            try {
                const orders = await getOrders({program});
                setOrders(orders);
            } catch (error) {
            }
        }
    }

    const fetchUSDCBalance = async () => {
        if (wallet && program) {
            try {
                const usdcWallets = await program.provider.connection.getTokenAccountsByOwner(wallet.publicKey, {mint: new anchor.web3.PublicKey(STABLE_COIN_KEY)});
                if (usdcWallets.value.length > 0) {
                    const balance = await program.provider.connection.getTokenAccountBalance(usdcWallets.value[0].pubkey);
                    setUsdc(balance.value.uiAmountString ?? '--');
                }
            } catch (error) {

            }
        }
    }

    const finishCreating = (borrower: string) => {
        if (borrower === wallet.publicKey.toString()) {
            setCreateLoading(false);
            enqueueSnackbar("Success to create new order!", {variant: 'success'});
            setOrders([]);
            setLastUpdatedTime(Date.now());
        }
    }

    const finishCancel = (borrower: string) => {
        if (borrower === wallet.publicKey.toString()) {
            setCancelLoading(false);
            enqueueSnackbar("Success to cancel order!", {variant: 'success'});
            setOrders([]);
            setLastUpdatedTime(Date.now());
        }
    }

    const finishLoan = (lender: string, borrower: string) => {
        if (lender === wallet.publicKey.toString()) {
            setLoanLoading(false);
            enqueueSnackbar("Success to cancel order!", {variant: 'success'});
            setOrders([]);
            setLastUpdatedTime(Date.now());
        }
        if (borrower === wallet.publicKey.toString()) {
            enqueueSnackbar("Your order confirmed!", {variant: 'success'});
            setOrders([]);
            setLastUpdatedTime(Date.now());
        }
    }

    const finishPayBack = (borrower: string) => {
        if (borrower === wallet.publicKey.toString()) {
            setPaybackLoading(false);
            enqueueSnackbar("PayBack success!", {variant: 'success'});
            setOrders([]);
            setLastUpdatedTime(Date.now());
        }
    }

    const finishLiquidity = (borrower: string, lender: string) => {
        if (lender === wallet.publicKey.toString()) {
            setLiquidityLoading(false);
            enqueueSnackbar("Liquidity success!", {variant: 'success'});
            setOrders([]);
            setLastUpdatedTime(Date.now());
        }
        if (borrower === wallet.publicKey.toString()) {
            enqueueSnackbar("You order has been liquidated", {variant: 'warning'});
        }
    }

    if (program) {
        program.addEventListener("CreatedOrderEvent", (event, slot) => {
            finishCreating(event.borrower.toString());
        });

        program.addEventListener("CanceledOrderEvent", (event, slot) => {
            finishCancel(event.borrower.toString());
        });

        program.addEventListener("LoanOrderEvent", (event, slot) => {
            finishLoan(event.lender.toString(), event.borrower.toString());
        });

        program.addEventListener("PayBackOrderEvent", (event, slot) => {
            finishPayBack(event.borrower.toString());
        });

        program.addEventListener("LiquidityOrderEvent", (event, slot) => {
            finishLiquidity(event.borrower.toString, event.lender.toString());
        });
    }

    // Create Order Section
    const handleClickOpen = () => {
        if (createLoading) {
            enqueueSnackbar("Please wait until finish other work", {variant: 'error'});
        } else {
            setNft("");
            setOpen(true);
        }

    }

    const handleClose = () => {
        setOpen(false);
    }

    const handleNftChange = (val: string) => {
        setNft(val);
    }

    const createOrderHandler = async () => {
        if (!program) return;
        if (nft == '') return;
        setOpen(false);
        setCreateLoading(true);
        const tx = await createOrder({program, wallet, nftToken: nft});
        console.log("Finish Call CreateOrder");
        if (!tx) {
            enqueueSnackbar("Failed to create new order", {variant: 'error'});
            setCreateLoading(false);
        }
    }
    //-------------------------------------------------------

    const cancelOrderHandler = async (item: Order) => {
        if (!program) return;
        if (cancelLoading) return;
        setCancelLoading(true);
        const tx = await cancelOrder({program, wallet, orderData: item});
        if (!tx) {
            enqueueSnackbar("Failed to cancel order", {variant: 'error'});
            setCancelLoading(false);
        }
    }

    const loanHandler = async (item: Order) => {
        if (!program) return;
        if (loanLoading) return;
        setLoanLoading(true);
        const tx = await loanOrder({program, wallet, orderData: item});
        if (!tx) {
            enqueueSnackbar("Failed to cancel order", {variant: 'error'});
            setLoanLoading(false);
        }
    }

    const payBackHandler = async (item: Order) => {
        if (!program) return;
        if (paybackLoading) return;
        setPaybackLoading(true);
        const tx = await payBack({program, wallet, orderData: item});
        if (!tx) {
            enqueueSnackbar("Failed to payback request", {variant: 'error'});
            setPaybackLoading(false);
        }
    }

    const liquidityHandler = async (item: Order) => {
        if (!program) return;
        if (liquidityLoading) return;
        setLiquidityLoading(true);
        const tx = await liquidity({program, wallet, orderData: item});
        if (!tx) {
            enqueueSnackbar("Failed to liquidity request", {variant: 'error'});
            setPaybackLoading(false);
        }
    }

    return (
        <Container maxWidth={"xl"} sx={{paddingTop: "10px"}}>
            My USDC: {usdc}
            <Box sx={{height: "20px"}}/>
            {wallet ? <Button variant="contained" size={"small"} onClick={handleClickOpen}>Create New Order</Button> : ''}
            <Box sx={{height: "20px"}}/>
            {wallet ? orders.length > 0 ? <Box>
                    {
                        orders.map((item) => (
                            <Card key={item.orderId.toString()} sx={{marginBottom: "10px", position: "relative"}}>
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid item xs={2}>
                                            <NFTImage nft={item.nftMint.toString()} program={program}/>
                                        </Grid>
                                        <Grid item xs={8}>
                                            <Stack direction={"column"} spacing={2}>
                                                <Stack direction={"row"} spacing={2}>
                                                    <LabelValueTypography>Order Pubkey: </LabelValueTypography>
                                                    <SpanValueTypography>{item.key}</SpanValueTypography>
                                                </Stack>
                                                <Stack direction={"row"} spacing={2}>
                                                    <LabelValueTypography>Borrowers: </LabelValueTypography>
                                                    <SpanValueTypography>{item.borrowerDisplay}</SpanValueTypography>
                                                </Stack>
                                                <Stack direction={"row"} spacing={2}>
                                                    <LabelValueTypography>NFT Token: </LabelValueTypography>
                                                    <SpanValueTypography>{item.nftMint.toBase58()}</SpanValueTypography>
                                                </Stack>
                                            </Stack>
                                        </Grid>
                                        <Grid item xs={2}>
                                            <Stack direction={"column"} justifyContent={"center"} alignItems={"center"} sx={{height: "100%"}}>
                                                {item.orderStatus && item.loanStartTime == "0" && item.borrower.toBase58() == wallet.publicKey.toBase58() ?
                                                    <LoadingButton
                                                        variant={"contained"}
                                                        size={"small"}
                                                        disabled={cancelLoading}
                                                        onClick={() => {
                                                            cancelOrderHandler(item);
                                                        }}>
                                                        Cancel Order
                                                    </LoadingButton> : ''}
                                                {item.orderStatus && item.loanStartTime == "0" && item.borrower.toBase58() != wallet.publicKey.toBase58() ?
                                                    <LoadingButton
                                                        variant={"contained"}
                                                        disabled={loanLoading}
                                                        onClick={() => {
                                                            loanHandler(item);
                                                        }}>
                                                        Give Loan
                                                    </LoadingButton> : ''}

                                                {!item.orderStatus && item.loanStartTime != "0" && item.paidBackAt == "0" && item.withdrewAt == "0" && item.lender.toBase58() == wallet.publicKey.toBase58() ?
                                                    <LoadingButton
                                                        variant={"contained"}
                                                        disabled={liquidityLoading}
                                                        onClick={() => {
                                                            liquidityHandler(item);
                                                        }}>
                                                        Liquidity
                                                    </LoadingButton> : ''}
                                                {!item.orderStatus && item.loanStartTime != "0" && item.paidBackAt == "0" && item.withdrewAt == "0" && item.borrower.toBase58() == wallet.publicKey.toBase58() ?
                                                    <LoadingButton
                                                        variant={"contained"}
                                                        disabled={paybackLoading}
                                                        onClick={() => {
                                                            payBackHandler(item);
                                                        }}>
                                                        PayBack
                                                    </LoadingButton> : ''}
                                            </Stack>
                                        </Grid>
                                    </Grid>
                                    <Box sx={{position: "absolute", top: "10px", right: "10px"}}>
                                        {item.orderStatus && item.loanStartTime == "0" ? <Chip label="New" color="info" size={"small"}/> : ''}
                                        {!item.orderStatus && item.loanStartTime == "0" ? <Chip label="Canceled" size={"small"}/> : ''}
                                        {!item.orderStatus && item.loanStartTime != "0" && item.paidBackAt == "0" && item.withdrewAt == "0" ? <Chip label="Loaning..." color="warning" size={"small"}/> : ''}
                                        {!item.orderStatus && item.paidBackAt != "0" ? <Chip label="Success" color="success" size={"small"}/> : ''}
                                        {!item.orderStatus && item.withdrewAt != "0" ? <Chip label="Liquidate" color="error" size={"small"}/> : ''}
                                    </Box>
                                </CardContent>
                            </Card>
                        ))
                    }
                </Box>
                : (<div>No Orders</div>) : <div>Your wallet did not connected.</div>}
            <Snackbar open={createLoading} anchorOrigin={{vertical: 'top', horizontal: 'right'}}>
                <Alert icon={false} severity="success" sx={{width: '100%'}}>
                    <Stack direction={"row"} spacing={2} justifyContent={"start"} alignItems={"center"}>
                        <CircularProgress size={20}/>
                        <Typography sx={{fontSize: "15px", color: "green"}}>Creating order</Typography>
                    </Stack>
                </Alert>
            </Snackbar>
            <Snackbar open={cancelLoading} anchorOrigin={{vertical: 'top', horizontal: 'right'}}>
                <Alert icon={false} severity="success" sx={{width: '100%'}}>
                    <Stack direction={"row"} spacing={2} justifyContent={"start"} alignItems={"center"}>
                        <CircularProgress size={20}/>
                        <Typography sx={{fontSize: "15px", color: "green"}}>Canceling order</Typography>
                    </Stack>
                </Alert>
            </Snackbar>
            <Snackbar open={loanLoading} anchorOrigin={{vertical: 'top', horizontal: 'right'}}>
                <Alert icon={false} severity="success" sx={{width: '100%'}}>
                    <Stack direction={"row"} spacing={2} justifyContent={"start"} alignItems={"center"}>
                        <CircularProgress size={20}/>
                        <Typography sx={{fontSize: "15px", color: "green"}}>Start Loaning</Typography>
                    </Stack>
                </Alert>
            </Snackbar>
            <Snackbar open={paybackLoading} anchorOrigin={{vertical: 'top', horizontal: 'right'}}>
                <Alert icon={false} severity="success" sx={{width: '100%'}}>
                    <Stack direction={"row"} spacing={2} justifyContent={"start"} alignItems={"center"}>
                        <CircularProgress size={20}/>
                        <Typography sx={{fontSize: "15px", color: "green"}}>Pay Back request in progress</Typography>
                    </Stack>
                </Alert>
            </Snackbar>
            <Snackbar open={liquidityLoading} anchorOrigin={{vertical: 'top', horizontal: 'right'}}>
                <Alert icon={false} severity="success" sx={{width: '100%'}}>
                    <Stack direction={"row"} spacing={2} justifyContent={"start"} alignItems={"center"}>
                        <CircularProgress size={20}/>
                        <Typography sx={{fontSize: "15px", color: "green"}}>Liquidity request in progress</Typography>
                    </Stack>
                </Alert>
            </Snackbar>
            <Dialog open={open}>
                <DialogTitle>Create Order</DialogTitle>
                <DialogContent>
                    <Stack direction={"row"} justifyContent={"space-between"} alignItems={"center"}>
                        <Typography sx={{fontSize: "15px"}}>NFT</Typography>
                        <Typography sx={{fontSize: "15px"}}>1</Typography>
                    </Stack>
                    <Stack direction={"row"} justifyContent={"space-between"} alignItems={"center"}>
                        <Typography sx={{fontSize: "15px"}}>NFT Worth</Typography>
                        <Typography sx={{fontSize: "15px"}}>80 USDC</Typography>
                    </Stack>
                    <Stack direction={"row"} justifyContent={"space-between"} alignItems={"center"}>
                        <Typography sx={{fontSize: "15px"}}>Collaterize(10%)</Typography>
                        <Typography sx={{fontSize: "15px"}}>8 USDC</Typography>
                    </Stack>
                    <Stack direction={"row"} justifyContent={"space-between"} alignItems={"center"}>
                        <Typography sx={{fontSize: "15px"}}>Service Fee(1%)</Typography>
                        <Typography sx={{fontSize: "15px"}}>0.8 USDC</Typography>
                    </Stack>
                    <Divider sx={{height: "15px"}}/>
                    <Stack direction={"row"} justifyContent={"space-between"} alignItems={"center"}>
                        <Typography sx={{fontSize: "15px"}}>Summary</Typography>
                        <Typography sx={{fontSize: "15px"}}>1 NFT + 8.8 USDC</Typography>
                    </Stack>
                    <Typography component={"span"} sx={{fontSize: "12px"}}>NFT Token Address</Typography>
                    <TextField
                        margin="dense"
                        id="nft_token_address"
                        size={"small"}
                        fullWidth
                        variant="outlined"
                        inputProps={{
                            value: nft,
                            onChange: (event) => {
                                // @ts-ignore
                                handleNftChange(event.target.value);
                            },
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <LoadingButton onClick={createOrderHandler}>Add Order</LoadingButton>
                    <LoadingButton onClick={handleClose}>Cancel</LoadingButton>
                </DialogActions>
            </Dialog>
        </Container>
    );
}

export default Home
