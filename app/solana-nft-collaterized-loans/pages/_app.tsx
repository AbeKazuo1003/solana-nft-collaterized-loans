import * as React from 'react';
import {useMemo} from "react";
import '../styles/globals.css'
import {StyledEngineProvider, ThemeProvider} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {CacheProvider, EmotionCache} from '@emotion/react';
import type {AppProps} from 'next/app'
import createEmotionCache from '../src/createEmotionCache';
import {ConnectionProvider, WalletProvider} from "@solana/wallet-adapter-react";
import {WalletAdapterNetwork} from "@solana/wallet-adapter-base";
import {clusterApiUrl} from "@solana/web3.js";
import {PhantomWalletAdapter} from "@solana/wallet-adapter-phantom";
import {WalletModalProvider} from "@solana/wallet-adapter-react-ui";
import {createTheme} from "@mui/material";
import {deepPurple} from "@mui/material/colors";
import Header from "../components/Header";
import {SnackbarProvider} from "notistack";

require('@solana/wallet-adapter-react-ui/styles.css');

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();


interface MyAppProps extends AppProps {
    emotionCache?: EmotionCache;
}

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: deepPurple[700],
        },
    },
    components: {
        MuiButtonBase: {
            styleOverrides: {
                root: {
                    justifyContent: 'flex-start',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    padding: '12px 16px',
                },
                startIcon: {
                    marginRight: 8,
                },
                endIcon: {
                    marginLeft: 8,
                },
            },
        },
    },
})

export default function MyApp(props: MyAppProps) {
    const {Component, emotionCache = clientSideEmotionCache, pageProps} = props;
    const network = WalletAdapterNetwork.Devnet;
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
        ],
        [network]
    );
    return (
        <CacheProvider value={emotionCache}>
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={theme}>
                    {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
                    <CssBaseline/>
                    <ConnectionProvider endpoint={endpoint}>
                        <WalletProvider wallets={wallets} autoConnect>
                            <WalletModalProvider>
                                <Header />
                                <SnackbarProvider maxSnack={5}>
                                    <Component {...pageProps} />
                                </SnackbarProvider>
                            </WalletModalProvider>
                        </WalletProvider>
                    </ConnectionProvider>
                </ThemeProvider>
            </StyledEngineProvider>
        </CacheProvider>
    );
}
