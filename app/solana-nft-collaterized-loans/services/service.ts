import * as anchor from "@project-serum/anchor";
import {CONFIG_PDA_SEED, NFT_PDA_SEED, ORDER_PDA_SEED, STABLE_COIN_KEY, STABLE_COIN_PDA_SEED} from "../utils/consts";
import {ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {Order, OrderData} from "../src/Models/Order";
import {Transaction} from "@solana/web3.js";
import {signSendAndConfirm} from "../utils/solanaHelper";

type GetOrderProps = {
    program: anchor.Program<anchor.Idl>;
    filter?: unknown[];
}

export const getOrders = async ({program, filter = []}: GetOrderProps) => {
    let result: Order[] = [];
    let orders = await program.account.order.all();
    orders.map((item) => {
        const orderItem: OrderData = {
            borrower: item.account.borrower,
            stableCoinVault: item.account.stableCoinVault,
            nftMint: item.account.nftMint,
            nftVault: item.account.nftVault,
            requestAmount: item.account.requestAmount,
            interest: item.account.interest,
            period: item.account.period,
            additionalCollateral: item.account.additionalCollateral,
            lender: item.account.lender,
            createdAt: item.account.createdAt,
            loanStartTime: item.account.loanStartTime,
            paidBackAt: item.account.paidBackAt,
            withdrewAt: item.account.withdrewAt,
            orderStatus: item.account.orderStatus,
            orderId: item.account.orderId,
            nonce: item.account.nonce,
        };
        result.push(new Order(item.publicKey, orderItem));
    });
    return result;
}

type CreateOrder = {
    program: anchor.Program<anchor.Idl>;
    wallet: any;
    nftToken: string;
};

export const createOrder = async ({program, wallet, nftToken}: CreateOrder) => {
    try {
        const stableMintPubKey: anchor.web3.PublicKey = new anchor.web3.PublicKey(STABLE_COIN_KEY);
        const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from(CONFIG_PDA_SEED)], program.programId);
        const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress([
            stableMintPubKey.toBuffer(),
            Buffer.from(STABLE_COIN_PDA_SEED),
        ], program.programId);
        const configFetch = await program.account.configuration.fetch(config);
        const nftMintPubKey: anchor.web3.PublicKey = new anchor.web3.PublicKey(nftToken);
        const feeVaultPubKey: anchor.web3.PublicKey = new anchor.web3.PublicKey(configFetch.feeCoinVault.toString())
        const [order, orderBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(new anchor.BN(configFetch.orderId.toString()).toString()),
                Buffer.from(ORDER_PDA_SEED),
            ],
            program.programId);
        const [nft, nftBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                nftMintPubKey.toBuffer(),
                Buffer.from(NFT_PDA_SEED)
            ],
            program.programId);

        let userUSDC = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            stableMintPubKey,
            wallet.publicKey
        );
        let userNft = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            nftMintPubKey,
            wallet.publicKey
        );

        await program.rpc.createOrder(stableBump, nftBump, orderBump, {
            accounts: {
                config: config,
                stableCoinMint: stableMintPubKey,
                stableCoinVault: stable,
                feeCoinVault: feeVaultPubKey,
                userStableCoinVault: userUSDC,
                nftMint: nftMintPubKey,
                nftVault: nft,
                userNftVault: userNft,
                order: order,
                borrower: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            signers: [wallet.payer]
        });
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}

type CancelOrder = {
    program: anchor.Program<anchor.Idl>;
    wallet: any;
    orderData: Order;
}

export const cancelOrder = async ({program, wallet, orderData}: CancelOrder) => {
    try {
        const stableMintPubKey: anchor.web3.PublicKey = new anchor.web3.PublicKey(STABLE_COIN_KEY);
        const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from(CONFIG_PDA_SEED)], program.programId);
        const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress([
            stableMintPubKey.toBuffer(),
            Buffer.from(STABLE_COIN_PDA_SEED),
        ], program.programId);

        const [nft, nftBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                orderData.nftMint.toBuffer(),
                Buffer.from(NFT_PDA_SEED)
            ], program.programId);
        const [order, orderBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(orderData.orderId.toString()),
                Buffer.from(ORDER_PDA_SEED),
            ],
            program.programId);

        let userUSDC = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            stableMintPubKey,
            wallet.publicKey
        );
        let userNft = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            orderData.nftMint,
            wallet.publicKey
        )

        await program.rpc.cancelOrder(orderData.orderId, stableBump, nftBump, {
            accounts: {
                config: config,
                order: order,
                stableCoinMint: stableMintPubKey,
                stableCoinVault: stable,
                userStableCoinVault: userUSDC,
                nftMint: orderData.nftMint,
                nftVault: nft,
                userNftVault: userNft,
                borrower: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [wallet.payer]
        });

        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}

type LoanOrder = {
    program: anchor.Program<anchor.Idl>;
    wallet: any;
    orderData: Order;
}

export const loanOrder = async ({program, wallet, orderData}: LoanOrder) => {
    try {
        const stableMintPubKey: anchor.web3.PublicKey = new anchor.web3.PublicKey(STABLE_COIN_KEY);
        const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from(CONFIG_PDA_SEED)], program.programId);
        const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress([
            stableMintPubKey.toBuffer(),
            Buffer.from(STABLE_COIN_PDA_SEED),
        ], program.programId);
        const configFetch = await program.account.configuration.fetch(config);
        const feeVaultPubKey: anchor.web3.PublicKey = new anchor.web3.PublicKey(configFetch.feeCoinVault.toString())
        const [order, orderBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(orderData.orderId.toString()),
                Buffer.from(ORDER_PDA_SEED),
            ],
            program.programId);

        let borrowerUSDC = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            stableMintPubKey,
            orderData.borrower,
        );

        let lenderUSDC = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            stableMintPubKey,
            wallet.publicKey
        );

        await program.rpc.giveLoan(orderData.orderId, stableBump, {
            accounts: {
                config: config,
                order: order,
                stableCoinMint: stableMintPubKey,
                stableCoinVault: stable,
                feeCoinVault: feeVaultPubKey,
                lenderStableCoinVault: lenderUSDC,
                borrowerStableCoinVault: borrowerUSDC,
                lender: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [wallet.payer]
        });

        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}

type PayBack = {
    program: anchor.Program<anchor.Idl>;
    wallet: any;
    orderData: Order;
}

export const payBack = async ({program, wallet, orderData}: PayBack) => {
    try {
        const stableMintPubKey: anchor.web3.PublicKey = new anchor.web3.PublicKey(STABLE_COIN_KEY);
        const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from(CONFIG_PDA_SEED)], program.programId);
        const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress([
            stableMintPubKey.toBuffer(),
            Buffer.from(STABLE_COIN_PDA_SEED),
        ], program.programId);

        const [nft, nftBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                orderData.nftMint.toBuffer(),
                Buffer.from(NFT_PDA_SEED)
            ], program.programId);

        const [order, orderBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(orderData.orderId.toString()),
                Buffer.from(ORDER_PDA_SEED),
            ],
            program.programId);

        let borrowerUSDC = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            stableMintPubKey,
            wallet.publicKey,
        );

        let lenderUSDC = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            stableMintPubKey,
            orderData.lender,
        );

        let borrowerNFT = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            orderData.nftMint,
            wallet.publicKey
        )

        await program.rpc.payback(orderData.orderId, stableBump, nftBump, {
            accounts: {
                config: config,
                order: order,
                stableCoinMint: stableMintPubKey,
                stableCoinVault: stable,
                lenderStableCoinVault: lenderUSDC,
                borrowerStableCoinVault: borrowerUSDC,
                nftMint: orderData.nftMint,
                nftVault: nft,
                borrowerNftVault: borrowerNFT,
                borrower: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [wallet.payer]
        });
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}

type Liquidity = {
    program: anchor.Program<anchor.Idl>;
    wallet: any;
    orderData: Order;
}
export const liquidity = async ({program, wallet, orderData}: Liquidity) => {
    try {
        const stableMintPubKey: anchor.web3.PublicKey = new anchor.web3.PublicKey(STABLE_COIN_KEY);
        const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from(CONFIG_PDA_SEED)], program.programId);
        const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress([
            stableMintPubKey.toBuffer(),
            Buffer.from(STABLE_COIN_PDA_SEED),
        ], program.programId);

        const [nft, nftBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                orderData.nftMint.toBuffer(),
                Buffer.from(NFT_PDA_SEED)
            ], program.programId);

        const [order, orderBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(orderData.orderId.toString()),
                Buffer.from(ORDER_PDA_SEED),
            ],
            program.programId);

        let lenderUSDC = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            stableMintPubKey,
            wallet.publicKey,
        );
        let lenderNFT = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            orderData.nftMint,
            wallet.publicKey,
        );

        let checkLenderNft = await program.provider.connection.getAccountInfo(lenderNFT);
        if (!checkLenderNft) {
            const transaction = new Transaction().add(
                await Token.createAssociatedTokenAccountInstruction(
                    ASSOCIATED_TOKEN_PROGRAM_ID,
                    TOKEN_PROGRAM_ID,
                    orderData.nftMint,
                    lenderNFT,
                    wallet.publicKey,
                    wallet.publicKey,
                )
            );
            const {blockhash} = await program.provider.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new anchor.web3.PublicKey(wallet.publicKey);
            await signSendAndConfirm(wallet, program.provider.connection, transaction);
        }
        await program.rpc.liquidate(orderData.orderId, stableBump, nftBump, {
            accounts: {
                config: config,
                order: order,
                stableCoinMint: stableMintPubKey,
                stableCoinVault: stable,
                lenderStableCoinVault: lenderUSDC,
                nftMint: orderData.nftMint,
                nftVault: nft,
                lenderNftVault: lenderNFT,
                lender: wallet.publicKey,
                borrower: orderData.borrower,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [wallet.payer]
        });
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}
