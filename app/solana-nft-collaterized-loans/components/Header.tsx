import Container from "@mui/material/Container";
import {AppBar, Stack, Toolbar} from "@mui/material";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import * as React from "react";

const Header = () => {
    return (<AppBar position={"static"}>
            <Container maxWidth={"xl"}>
                <Toolbar disableGutters>
                    <Typography
                        variant="h6"
                        noWrap
                        component="div"
                        sx={{mr: 2, display: {xs: 'none', md: 'flex'}}}
                    >
                        NFT Collaterized Loans
                    </Typography>
                    <Box sx={{flexGrow: 1, display: {xs: 'none', md: 'flex'}}}>
                    </Box>
                    <Stack direction={"row"} gap={3}>
                        <WalletMultiButton/>
                    </Stack>
                </Toolbar>
            </Container>
        </AppBar>
    );
}

export default Header;