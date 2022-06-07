import * as anchor from "@project-serum/anchor";
import {Program} from "@project-serum/anchor";
import {SolanaNftCollaterizedLoans} from "../target/types/solana_nft_collaterized_loans";
import {Token, TOKEN_PROGRAM_ID} from "@solana/spl-token";

const utils = require('./utils');
import * as fs from "fs";
import * as assert from "assert";

const provider = anchor.Provider.env();
anchor.setProvider(provider);

const program = anchor.workspace.SolanaNftCollaterizedLoans as Program<SolanaNftCollaterizedLoans>;

const CONFIG_PDA_SEED = "config";
const STABLE_COIN_PDA_SEED = "stable";
const NFT_PDA_SEED = "nft";
const ORDER_PDA_SEED = "order";

describe("solana-nft-collaterized-loans", () => {
    const USDC = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

    let isTestPayBack: boolean = false;
    let stableCoinMintKeyPair: anchor.web3.Keypair;
    let stableCoinMintObject: Token;
    let stableCoinMintPubKey: anchor.web3.PublicKey;

    let nftMintPubKey: anchor.web3.PublicKey;
    let nftMintObject: Token;

    let alice: anchor.web3.Keypair;
    let aliceStableCoinWallet: anchor.web3.PublicKey;
    let aliceNftWallet: anchor.web3.PublicKey;

    let bob: anchor.web3.Keypair;
    let bobStableCoinWallet: anchor.web3.PublicKey;
    let bobNftWallet: anchor.web3.PublicKey;

    let feeVault: anchor.web3.PublicKey;

    let configKeyPair: anchor.web3.Keypair;

    it('Prepare', async () => {
        configKeyPair = anchor.web3.Keypair.generate()
        // Create StableCoin
        let keyPairFile = fs.readFileSync('/home/alex/blockchain/solana-nft-collaterized-loans/tests/keys/stablecoin.json', "utf-8");
        let keyPairData = JSON.parse(keyPairFile);
        stableCoinMintKeyPair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(keyPairData));
        stableCoinMintObject = await utils.createMint(stableCoinMintKeyPair, provider, provider.wallet.publicKey, null, 6, TOKEN_PROGRAM_ID);
        stableCoinMintPubKey = stableCoinMintObject.publicKey;
        console.log(stableCoinMintPubKey.toString());
        // Load Alice
        let alicePairFile = fs.readFileSync('/home/alex/blockchain/solana-nft-collaterized-loans/tests/keys/alice.json', "utf-8");
        let alicePairData = JSON.parse(alicePairFile);
        alice = anchor.web3.Keypair.fromSecretKey(new Uint8Array(alicePairData));

        // Airdrop 10 SOL to alice
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(
                alice.publicKey,
                10_000_000_000
            ),
            "confirmed"
        );

        // Load Bob
        let bobPairFile = fs.readFileSync('/home/alex/blockchain/solana-nft-collaterized-loans/tests/keys/bob.json', "utf-8");
        let bobPairData = JSON.parse(bobPairFile);
        bob = anchor.web3.Keypair.fromSecretKey(new Uint8Array(bobPairData));

        // Airdrop 10 SOL to Bob
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(
                bob.publicKey,
                10_000_000_000
            ),
            "confirmed"
        );

        // create stable Token wallet for alice and bob
        aliceStableCoinWallet = await stableCoinMintObject.createAssociatedTokenAccount(alice.publicKey);
        bobStableCoinWallet = await stableCoinMintObject.createAssociatedTokenAccount(bob.publicKey);

        // Create stable Token wallet for Fee Vault
        feeVault = await stableCoinMintObject.createAssociatedTokenAccount(provider.wallet.publicKey);

        // Airdrop StableCoin To Alice
        await utils.mintToAccount(provider, stableCoinMintPubKey, aliceStableCoinWallet, 1000_000_000);

        // Airdrop StableCoin To Bob
        await utils.mintToAccount(provider, stableCoinMintPubKey, bobStableCoinWallet, 1000_000_000);

        // Create Nft Token
        let mintKeyNft = anchor.web3.Keypair.generate();
        nftMintObject = await utils.createMint(mintKeyNft, provider, provider.wallet.publicKey, null, 0, TOKEN_PROGRAM_ID);
        nftMintPubKey = nftMintObject.publicKey;

        // Create NFT Account for Alice and Bob
        aliceNftWallet = await nftMintObject.createAssociatedTokenAccount(alice.publicKey);
        bobNftWallet = await nftMintObject.createAssociatedTokenAccount(bob.publicKey);
        // Mint Nft Token to alice
        await utils.mintToAccount(provider, nftMintPubKey, aliceNftWallet, 1);

        console.log("Alice: ", alice.publicKey.toString());
        console.log("Bob: ", bob.publicKey.toString());
        assert.strictEqual(await utils.getTokenBalance(provider, aliceStableCoinWallet), 1000_000_000);
        assert.strictEqual(await utils.getTokenBalance(provider, bobStableCoinWallet), 1000_000_000);
        assert.strictEqual(await utils.getTokenBalance(provider, aliceNftWallet), 1);
        assert.strictEqual(await utils.getTokenBalance(provider, bobNftWallet), 0);
    });
    it('Initialize', async () => {
        const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(CONFIG_PDA_SEED)
            ], program.programId);
        const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                stableCoinMintPubKey.toBuffer(),
                Buffer.from(STABLE_COIN_PDA_SEED)
            ], program.programId);
        await program.rpc.initialize(configBump, stableBump, {
            accounts: {
                signer: provider.wallet.publicKey,
                configuration: config,
                stableCoinMint: stableCoinMintPubKey,
                stableCoinVault: stable,
                feeCoinVault: feeVault,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            },
            // @ts-ignore
            signers: [provider.wallet.payer],
        });
        const fetch = await program.account.configuration.fetch(config);
        console.log(fetch);
    });

    it('Create Order', async () => {
        const listener = program.addEventListener("CreatedOrderEvent", (event, slot) => {
            console.log("slot: ", slot);
            console.log("event: ", event);
            program.removeEventListener(listener);
        })
        const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(CONFIG_PDA_SEED)
            ], program.programId);
        const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                stableCoinMintPubKey.toBuffer(),
                Buffer.from(STABLE_COIN_PDA_SEED)
            ], program.programId);
        const [nft, nftBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                nftMintPubKey.toBuffer(),
                Buffer.from(NFT_PDA_SEED)
            ], program.programId);
        const [order, orderBump] = await anchor.web3.PublicKey.findProgramAddress([
            Buffer.from(new anchor.BN(0).toString()),
            Buffer.from(ORDER_PDA_SEED),
        ], program.programId);

        await program.rpc.createOrder(stableBump, nftBump, orderBump, {
            accounts: {
                config: config,
                stableCoinMint: stableCoinMintPubKey,
                stableCoinVault: stable,
                feeCoinVault: feeVault,
                userStableCoinVault: aliceStableCoinWallet,
                nftMint: nftMintPubKey,
                nftVault: nft,
                userNftVault: aliceNftWallet,
                order: order,
                borrower: alice.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY
            },
            signers: [alice]
        });

        const fetch = await program.account.configuration.fetch(config);
        assert.strictEqual(fetch.orderId.toString(), "1");

        // Check alice wallet after create Order (ID: 0)
        assert.strictEqual(await utils.getTokenBalance(provider, aliceStableCoinWallet), 991_200_000);
        assert.strictEqual(await utils.getTokenBalance(provider, aliceNftWallet), 0);
        // Check vault wallet after create Order (ID: 0)
        assert.strictEqual(await utils.getTokenBalance(provider, stable), 8_000_000);
        assert.strictEqual(await utils.getTokenBalance(provider, nft), 1);

        // Check Fee Vault wallet after Create Order(ID: 0)
        assert.strictEqual(await utils.getTokenBalance(provider, feeVault), 800_000);
    });


    it("Cancel Order", async () => {
        const listener = program.addEventListener("CanceledOrderEvent", (event, slot) => {
            console.log("slot: ", slot);
            console.log("event: ", event);
            program.removeEventListener(listener);
        })
        const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(CONFIG_PDA_SEED)
            ], program.programId);
        const [order, orderBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(new anchor.BN(0).toString()),
                Buffer.from(ORDER_PDA_SEED),
            ],
            program.programId);
        const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                stableCoinMintPubKey.toBuffer(),
                Buffer.from(STABLE_COIN_PDA_SEED)
            ], program.programId);
        const [nft, nftBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                nftMintPubKey.toBuffer(),
                Buffer.from(NFT_PDA_SEED)
            ], program.programId);

        await program.rpc.cancelOrder(new anchor.BN(0), stableBump, nftBump, {
            accounts: {
                config: config,
                order: order,
                stableCoinMint: stableCoinMintPubKey,
                stableCoinVault: stable,
                userStableCoinVault: aliceStableCoinWallet,
                nftMint: nftMintPubKey,
                nftVault: nft,
                userNftVault: aliceNftWallet,
                borrower: alice.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [alice]
        });

        // Check alice wallet after Cancel Order (ID: 0)
        assert.strictEqual(await utils.getTokenBalance(provider, aliceStableCoinWallet), 999_200_000);
        assert.strictEqual(await utils.getTokenBalance(provider, aliceNftWallet), 1);
        // Check vault wallet after Cancel Order (ID: 0)
        assert.strictEqual(await utils.getTokenBalance(provider, stable), 0);

        // Check Fee Vault wallet after Cancel Order(ID: 0)
        assert.strictEqual(await utils.getTokenBalance(provider, feeVault), 800_000);
    });

    it("Give Loan", async () => {
        const listener = program.addEventListener("LoanOrderEvent", (event, slot) => {
            console.log("slot: ", slot);
            console.log("event: ", event);
            program.removeEventListener(listener);
        })
        const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(CONFIG_PDA_SEED)
            ], program.programId);
        const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                stableCoinMintPubKey.toBuffer(),
                Buffer.from(STABLE_COIN_PDA_SEED)
            ], program.programId);
        const [nft, nftBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                nftMintPubKey.toBuffer(),
                Buffer.from(NFT_PDA_SEED)
            ], program.programId);
        const [order, orderBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from(new anchor.BN(1).toString()),
                Buffer.from(ORDER_PDA_SEED),
            ], program.programId
        );
        await program.rpc.createOrder(stableBump, nftBump, orderBump, {
            accounts: {
                config: config,
                stableCoinMint: stableCoinMintPubKey,
                stableCoinVault: stable,
                feeCoinVault: feeVault,
                userStableCoinVault: aliceStableCoinWallet,
                nftMint: nftMintPubKey,
                nftVault: nft,
                userNftVault: aliceNftWallet,
                order: order,
                borrower: alice.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY
            },
            signers: [alice]
        });

        // Check alice wallet after create Order (ID: 1)
        assert.strictEqual(await utils.getTokenBalance(provider, aliceStableCoinWallet), 990_400_000);
        assert.strictEqual(await utils.getTokenBalance(provider, aliceNftWallet), 0);
        // Check vault wallet after create Order (ID: 1)
        assert.strictEqual(await utils.getTokenBalance(provider, stable), 8_000_000);
        assert.strictEqual(await utils.getTokenBalance(provider, nft), 1);

        // Check Fee Vault wallet after GiveLoan (ID: 1)
        assert.strictEqual(await utils.getTokenBalance(provider, feeVault), 1_600_000);

        await program.rpc.giveLoan(new anchor.BN(1), stableBump, {
            accounts: {
                config: config,
                order: order,
                stableCoinMint: stableCoinMintPubKey,
                stableCoinVault: stable,
                feeCoinVault: feeVault,
                lenderStableCoinVault: bobStableCoinWallet,
                borrowerStableCoinVault: aliceStableCoinWallet,
                lender: bob.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: [bob],
        });

        // Check alice wallet after GiveLoan (ID: 1)
        assert.strictEqual(await utils.getTokenBalance(provider, aliceStableCoinWallet), 1070_400_000);
        // Check bob wallet after GiveLoan (ID: 1)
        assert.strictEqual(await utils.getTokenBalance(provider, bobStableCoinWallet), 919_200_000);

        // Check Fee Vault wallet after GiveLoan (ID: 1)
        assert.strictEqual(await utils.getTokenBalance(provider, feeVault), 2_400_000);

        //Check order status (ID: 1)
        const fetch = await program.account.order.fetch(order);
        assert.strictEqual(fetch.lender.toString(), bob.publicKey.toString());
        assert.strictEqual(fetch.loanStartTime == new anchor.BN(0), false);
        assert.strictEqual(fetch.orderStatus, false);
    });

    it("PayBack", async () => {
        if (isTestPayBack) {
            const listener = program.addEventListener("PayBackOrderEvent", (event, slot) => {
                console.log("slot: ", slot);
                console.log("event: ", event);
                program.removeEventListener(listener);
            })
            const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress(
                [
                    Buffer.from(CONFIG_PDA_SEED)
                ], program.programId);
            const [order, orderBump] = await anchor.web3.PublicKey.findProgramAddress(
                [
                    Buffer.from(new anchor.BN(1).toString()),
                    Buffer.from(ORDER_PDA_SEED),
                ],
                program.programId);
            const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress(
                [
                    stableCoinMintPubKey.toBuffer(),
                    Buffer.from(STABLE_COIN_PDA_SEED)
                ], program.programId);
            const [nft, nftBump] = await anchor.web3.PublicKey.findProgramAddress(
                [
                    nftMintPubKey.toBuffer(),
                    Buffer.from(NFT_PDA_SEED)
                ], program.programId);

            await program.rpc.payback(new anchor.BN(1), stableBump, nftBump, {
                accounts: {
                    config: config,
                    order: order,
                    stableCoinMint: stableCoinMintPubKey,
                    stableCoinVault: stable,
                    lenderStableCoinVault: bobStableCoinWallet,
                    borrowerStableCoinVault: aliceStableCoinWallet,
                    nftMint: nftMintPubKey,
                    nftVault: nft,
                    borrowerNftVault: aliceNftWallet,
                    borrower: alice.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
                signers: [alice],
            });

            // Check alice wallet after PayBack (ID: 1)
            assert.strictEqual(await utils.getTokenBalance(provider, aliceStableCoinWallet), 993_600_000);
            assert.strictEqual(await utils.getTokenBalance(provider, aliceNftWallet), 1);
            // Check bob wallet after PayBack (ID: 1)
            assert.strictEqual(await utils.getTokenBalance(provider, bobStableCoinWallet), 1004_000_000);
            // Check vault after PayBack (ID: 1)
            assert.strictEqual(await utils.getTokenBalance(provider, stable), 0);

            // Check Fee Vault wallet after PayBack (ID: 1)
            assert.strictEqual(await utils.getTokenBalance(provider, feeVault), 2_400_000);
        } else {
            console.log("Skip PayBack");
        }
    });

    it("Liquidity", async () => {
        if (!isTestPayBack) {
            const listener = program.addEventListener("LiquidityOrderEvent", (event, slot) => {
                console.log("slot: ", slot);
                console.log("event: ", event);
                program.removeEventListener(listener);
            })
            const [config, configBump] = await anchor.web3.PublicKey.findProgramAddress(
                [
                    Buffer.from(CONFIG_PDA_SEED)
                ], program.programId);
            const [stable, stableBump] = await anchor.web3.PublicKey.findProgramAddress(
                [
                    stableCoinMintPubKey.toBuffer(),
                    Buffer.from(STABLE_COIN_PDA_SEED)
                ], program.programId);
            const [nft, nftBump] = await anchor.web3.PublicKey.findProgramAddress(
                [
                    nftMintPubKey.toBuffer(),
                    Buffer.from(NFT_PDA_SEED)
                ], program.programId);
            const [order, orderBump] = await anchor.web3.PublicKey.findProgramAddress(
                [
                    Buffer.from(new anchor.BN(1).toString()),
                    Buffer.from(ORDER_PDA_SEED),
                ], program.programId
            );
            await program.rpc.liquidate(new anchor.BN(1),stableBump, nftBump,  {
                accounts: {
                    config: config,
                    order: order,
                    stableCoinMint: stableCoinMintPubKey,
                    stableCoinVault: stable,
                    lenderStableCoinVault: bobStableCoinWallet,
                    nftMint: nftMintPubKey,
                    nftVault: nft,
                    lenderNftVault: bobNftWallet,
                    lender: bob.publicKey,
                    borrower: alice.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
                signers: [bob]
            });

            // Check alice wallet after Liquidity (ID: 1)
            assert.strictEqual(await utils.getTokenBalance(provider, aliceStableCoinWallet), 1070_400_000);
            assert.strictEqual(await utils.getTokenBalance(provider, aliceNftWallet), 0);

            // Check bob wallet after Liquidity (ID: 1)
            assert.strictEqual(await utils.getTokenBalance(provider, bobStableCoinWallet), 927_200_000);
            assert.strictEqual(await utils.getTokenBalance(provider, bobNftWallet), 1);

            // Check vault after Liquidity (ID: 1)
            assert.strictEqual(await utils.getTokenBalance(provider, stable), 0);

            // Check Fee Vault wallet after Liquidity (ID: 1)
            assert.strictEqual(await utils.getTokenBalance(provider, feeVault), 2_400_000);
        } else {
            console.log("Skip Liquidity");
        }
    })
});
