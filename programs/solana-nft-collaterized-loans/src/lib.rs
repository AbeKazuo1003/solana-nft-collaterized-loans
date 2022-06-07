//! An Solana NFT Collaterized Loans program
use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Token, Mint};
use anchor_lang::solana_program::{clock};

pub mod constants {
    pub const CONFIG_PDA_SEED: &[u8] = b"config";
    pub const STABLE_COIN_PDA_SEED: &[u8] = b"stable";
    pub const NFT_PDA_SEED: &[u8] = b"nft";
    pub const ORDER_PDA_SEED: &[u8] = b"order";
}

declare_id!("32XNkUwWhSKsoUEY9dvApXWgMjtssVc9fD1aR1mBfQpe");

pub mod token_constants {
    // Devnet StableCoin
    pub const USDC_MINT_PUBKEY: &str = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
    // Localnet StableCoin
    //pub const USDC_MINT_PUBKEY: &str = "G7EY516o2hAWDxQ3g8Z9tSCh5gdkhp5Sz7WhHNFQ9kqA";
}

#[program]
pub mod solana_nft_collaterized_loans {
    use std::time::Duration;
    use super::*;

    /**
    * ****************************************
    *
    * Initialize Program Config
    * ****************************************
    */
    /// upgradeable Initialize
    /// @param _config_nonce            Program Config Account Address Nonce
    /// @param _stable_nonce            Program StableCoin Holding Account Address Nonce
    pub fn initialize(ctx: Context<Initialize>, _config_nonce: u8, _stable_nonce: u8) -> Result<()> {
        let config = &mut ctx.accounts.configuration;
        config.owner = ctx.accounts.signer.key();
        config.stable_coin_mint = ctx.accounts.stable_coin_mint.key();
        config.stable_coin_vault = ctx.accounts.stable_coin_vault.key();
        config.fee_coin_vault = ctx.accounts.fee_coin_vault.key();
        config.order_id = 0;
        config.total_additional_collateral = 0;
        config.nonce = _config_nonce;

        Ok(())
    }

    /**
     * ****************************************
     *
     * Update Program Config
     * ****************************************
     */
    /// @param _config_nonce            Program Config Account Address
    pub fn update_config(ctx: Context<UpdateConfig>, _config_nonce: u8) -> Result<()> {
        let config = &mut ctx.accounts.configuration;
        config.owner = ctx.accounts.signer.key();
        config.fee_coin_vault = ctx.accounts.fee_coin_vault.key();
        config.nonce = _config_nonce;

        Ok(())
    }


    #[derive(Accounts)]
    pub struct Test<'info> {
        #[account(
        constraint = nft_mint1.supply == 1,
        constraint = nft_mint1.decimals == 0,
        )]
        pub nft_mint1: Box<Account<'info, Mint>>,

        #[account(
        constraint = nft_mint2.supply == 1,
        constraint = nft_mint2.decimals == 0,
        )]
        pub nft_mint2: Box<Account<'info, Mint>>,

        #[account(mut)]
        pub signer: Signer<'info>,

        #[account()]
        /// CHECK: For MetaInfo
        pub meta_info1: AccountInfo<'info>,
        // misc
        pub system_program: Program<'info, System>,
        pub token_program: Program<'info, Token>,

        pub rent: Sysvar<'info, Rent>,
    }

    pub fn test(ctx: Context<Test>, _order_id: u64) -> Result<()> {
        msg!("Mint Account1 {:?}", &ctx.accounts.nft_mint1.key());
        msg!("Mint Account2 {:?}", &ctx.accounts.nft_mint2.key());
        let (metadata_address1, _) = Pubkey::find_program_address(
            &["metadata".as_bytes(),
                &spl_token_metadata::ID.to_bytes(),
                &ctx.accounts.nft_mint1.key().to_bytes()],
            &spl_token_metadata::ID);
        msg!("Mint MetaData Address1 {:?}", metadata_address1);
        let (metadata_address2, _) = Pubkey::find_program_address(
            &["metadata".as_bytes(),
                &spl_token_metadata::ID.to_bytes(),
                &ctx.accounts.nft_mint2.key().to_bytes()],
            &spl_token_metadata::ID);
        msg!("Mint MetaData Address2 {:?}", metadata_address2);
        let metadata = spl_token_metadata::state::Metadata::from_account_info(ctx.accounts.meta_info1.as_ref())?;

        let creators = metadata.data.creators.unwrap();
        let cndy = creators.first().unwrap();
        msg!("Creator {:?}", cndy.address);

        /*let body = reqwest::get("https://www.rust-lang.org")
            .await?
            .text()
            .await?;

        msg!("body = {:?}", body);*/
        /*let response = reqwest::get(metadata.data.uri).await?;
        let metadata_uri : MetaDataURI = response.json().await?;
        msg!("Name {:?}", metadata_uri.name);
        msg!("Name {:?}", metadata_uri.symbol);*/
        Ok(())
    }

    /**
     * ****************************************
     *
     * Create New Order to Loan
     * ****************************************
     */
    /// @param _stable_nonce            Program StableCoin Holding Account Nonce
    /// @param _nft_nonce               Program Nft Holding Account Nonce
    /// @param _order_nonce             Program Order Info Account Nonce

    pub fn create_order(
        ctx: Context<CreateOrder>,
        _stable_nonce: u8,
        _nft_nonce: u8,
        _order_nonce: u8,
    ) -> Result<()> {
        let request_amount: u64 = 80_000_000;
        let additional_collateral: u64 = 8_000_000;
        let fee_amount: u64 = 800_000;
        let payback_amount: u64 = 3_200_000;
        let interest: u64 = 4_800_000;
        //let period = Duration::from_secs(60 * 60 * 24 * 7).as_secs();
        let period = Duration::from_secs(60 * 10).as_secs();

        let config = &mut ctx.accounts.config;
        // Transfer collateral to vault.
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_nft_vault.to_account_info(),
                    to: ctx.accounts.nft_vault.to_account_info(),
                    authority: ctx.accounts.borrower.to_account_info(), //Lock nft
                },
            );
            token::transfer(cpi_ctx, 1)?;
        }

        // Transfer fee to Service Wallet
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_stable_coin_vault.to_account_info(),
                    to: ctx.accounts.fee_coin_vault.to_account_info(),
                    authority: ctx.accounts.borrower.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, fee_amount)?;
        }

        // Transfer additional collateral to vault
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_stable_coin_vault.to_account_info(),
                    to: ctx.accounts.stable_coin_vault.to_account_info(),
                    authority: ctx.accounts.borrower.to_account_info(), //
                },
            );
            token::transfer(cpi_ctx, additional_collateral)?;
        }
        let clock = clock::Clock::get().unwrap();

        // Save Info
        let order = &mut ctx.accounts.order;
        order.borrower = ctx.accounts.borrower.key();
        order.stable_coin_vault = ctx.accounts.stable_coin_vault.key();
        order.nft_mint = ctx.accounts.nft_mint.key();
        order.nft_vault = ctx.accounts.nft_vault.key();
        order.request_amount = request_amount;
        order.payback_amount = payback_amount;
        order.fee_amount = fee_amount;
        order.interest = interest;
        order.period = period;
        order.additional_collateral = additional_collateral;
        order.lender = order.key(); // just a placeholder
        order.created_at = clock.unix_timestamp as u64;
        order.loan_start_time = 0; // placeholder
        order.paid_back_at = 0;
        order.withdrew_at = 0;
        order.order_id = config.order_id;
        order.nonce = _order_nonce;

        config.total_additional_collateral += additional_collateral;
        config.order_id += 1;

        order.order_status = true;

        emit!(CreatedOrderEvent {
            order_key: *order.to_account_info().key,
            borrower: *ctx.accounts.borrower.to_account_info().key,
        });

        Ok(())
    }

    /**
     * ****************************************
     *
     * Cancel Order
     * ****************************************
     */
    /// @param _order_id                Order Id to cancel order
    /// @param _stable_nonce            Program StableCoin Holding Account Nonce
    /// @param _nft_nonce               Program Nft Holding Account Nonce
    pub fn cancel_order(ctx: Context<CancelOrder>, _order_id: u64, _stable_nonce: u8, _nft_nonce: u8) -> Result<()> {
        let order = &mut ctx.accounts.order;
        let config = &mut ctx.accounts.config;

        if order.loan_start_time != 0 && order.order_status == false {
            return Err(ErrorCode::LoanAlreadyStarted.into());
        }

        // Transfer back nft collateral.
        {
            let seeds = &[
                ctx.accounts.nft_mint.to_account_info().key.as_ref(),
                constants::NFT_PDA_SEED.as_ref(),
                &[_nft_nonce]
            ];
            let signer = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.nft_vault.to_account_info(),
                    to: ctx.accounts.user_nft_vault.to_account_info(),
                    authority: ctx.accounts.nft_vault.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi_ctx, 1)?;

            // Close nft_vault
            {
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::CloseAccount {
                        account: ctx.accounts.nft_vault.to_account_info(),
                        destination: ctx.accounts.borrower.to_account_info(),
                        authority: ctx.accounts.nft_vault.to_account_info(),
                    },
                    signer,
                );
                token::close_account(cpi_ctx)?;
            }
        }

        // Transfer back additional collateral
        {
            let seeds = &[
                ctx.accounts.stable_coin_mint.to_account_info().key.as_ref(),
                constants::STABLE_COIN_PDA_SEED.as_ref(),
                &[_stable_nonce]
            ];
            let signer = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.stable_coin_vault.to_account_info(),
                    to: ctx.accounts.user_stable_coin_vault.to_account_info(),
                    authority: ctx.accounts.stable_coin_vault.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi_ctx, order.additional_collateral)?;
        }

        // Save Info
        config.total_additional_collateral -= order.additional_collateral;

        //
        emit!(CanceledOrderEvent {
            order_key: *order.to_account_info().key,
            borrower: *ctx.accounts.borrower.to_account_info().key,
        });

        Ok(())
    }

    /**
     * ****************************************
     *
     * Start loan
     * ****************************************
     */
    /// @param _order_id                Order Id to start loan
    /// @param _stable_nonce            Program StableCoin Holding Account Nonce
    pub fn give_loan(ctx: Context<GiveLoan>, _order_id: u64, _stable_nonce: u8) -> Result<()> {
        let order = &mut ctx.accounts.order;
        if order.loan_start_time != 0 && order.order_status == false {
            return Err(ErrorCode::LoanAlreadyStarted.into());
        }

        // Transfer request amount to borrower
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.lender_stable_coin_vault.to_account_info(),
                    to: ctx.accounts.borrower_stable_coin_vault.to_account_info(),
                    authority: ctx.accounts.lender.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, order.request_amount)?;
        }

        // Transfer fee amount to service
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.lender_stable_coin_vault.to_account_info(),
                    to: ctx.accounts.fee_coin_vault.to_account_info(),
                    authority: ctx.accounts.lender.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, order.fee_amount)?;
        }

        // Save Info
        order.lender = ctx.accounts.lender.key();
        order.loan_start_time = clock::Clock::get().unwrap().unix_timestamp as u64;
        order.order_status = false;

        emit!(LoanOrderEvent {
            order_key: *order.to_account_info().key,
            borrower: order.borrower,
            lender: *ctx.accounts.lender.to_account_info().key,
        });
        Ok(())
    }

    /**
     * ****************************************
     *
     * Payback to return NFT
     * ****************************************
     */
    /// @param _order_id                Order Id to payback
    /// @param _stable_nonce            Program StableCoin Holding Account Nonce
    /// @param _nft_nonce               Program NFT Holding Account Nonce
    pub fn payback(ctx: Context<Payback>, _order_id: u64, _stable_nonce: u8, _nft_nonce: u8) -> Result<()> {
        let order = &mut ctx.accounts.order;
        let config = &mut ctx.accounts.config;

        if order.loan_start_time == 0 && order.order_status == true {
            return Err(ErrorCode::LoanNotProvided.into());
        }

        let clock = clock::Clock::get().unwrap();
        if order.loan_start_time.checked_add(order.period).unwrap() < clock.unix_timestamp as u64 {
            return Err(ErrorCode::RepaymentPeriodExceeded.into());
        }

        // Pay Loan
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.borrower_stable_coin_vault.to_account_info(),
                    to: ctx.accounts.lender_stable_coin_vault.to_account_info(),
                    authority: ctx.accounts.borrower.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, order.request_amount.checked_add(order.interest).unwrap())?;
        }

        // Transfer back nft collateral.
        {
            let seeds = &[
                ctx.accounts.nft_mint.to_account_info().key.as_ref(),
                constants::NFT_PDA_SEED.as_ref(),
                &[_nft_nonce]
            ];
            let signer = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.nft_vault.to_account_info(),
                    to: ctx.accounts.borrower_nft_vault.to_account_info(),
                    authority: ctx.accounts.nft_vault.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi_ctx, 1)?;

            // Close Nft Vault

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::CloseAccount {
                    account: ctx.accounts.nft_vault.to_account_info(),
                    destination: ctx.accounts.borrower.to_account_info(),
                    authority: ctx.accounts.nft_vault.to_account_info(),
                },
                signer,
            );
            token::close_account(cpi_ctx)?;
        }

        // Transfer back additional collateral
        {
            let seeds = &[
                ctx.accounts.stable_coin_mint.to_account_info().key.as_ref(),
                constants::STABLE_COIN_PDA_SEED.as_ref(),
                &[_stable_nonce]
            ];
            let signer = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.stable_coin_vault.to_account_info(),
                    to: ctx.accounts.borrower_stable_coin_vault.to_account_info(),
                    authority: ctx.accounts.stable_coin_vault.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi_ctx, order.additional_collateral)?;
        }

        //Save Info
        config.total_additional_collateral -= order.additional_collateral;

        emit!(PayBackOrderEvent {
            order_key: *order.to_account_info().key,
            borrower: *ctx.accounts.borrower.to_account_info().key,
        });

        Ok(())
    }

    /**
     * ****************************************
     *
     * Liquidity Loan Order
     * ****************************************
     */
    /// @param _order_id                Order Id to liquidity
    /// @param _stable_nonce            Program StableCoin Holding Account Nonce
    /// @param _nft_nonce               Program NFT Holding Account Nonce
    pub fn liquidate(ctx: Context<Liquidate>, _order_id: u64, _stable_nonce: u8, _nft_nonce: u8) -> Result<()> {
        let order = &mut ctx.accounts.order;
        let config = &mut ctx.accounts.config;

        // Validate order status to liquidity
        if order.loan_start_time == 0 && order.order_status == true {
            return Err(ErrorCode::LoanNotProvided.into());
        }

        // Check expire time
        let clock = clock::Clock::get().unwrap();
        if order.loan_start_time.checked_add(order.period).unwrap() > clock.unix_timestamp as u64 {
            //return Err(ErrorCode::RepaymentPeriodNotExceeded.into());
        }

        // Check duplicate action
        if order.withdrew_at != 0 {
            return Err(ErrorCode::AlreadyLiquidated.into());
        }

        // Transfer nft collateral.
        {
            let seeds = &[
                ctx.accounts.nft_mint.to_account_info().key.as_ref(),
                constants::NFT_PDA_SEED.as_ref(),
                &[_nft_nonce]
            ];
            let signer = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.nft_vault.to_account_info(),
                    to: ctx.accounts.lender_nft_vault.to_account_info(),
                    authority: ctx.accounts.nft_vault.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi_ctx, 1)?;

            // Close Nft Vault
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::CloseAccount {
                    account: ctx.accounts.nft_vault.to_account_info(),
                    destination: ctx.accounts.borrower.to_account_info(),
                    authority: ctx.accounts.nft_vault.to_account_info(),
                },
                signer,
            );
            token::close_account(cpi_ctx)?;
        }

        // Transfer additional collateral
        {
            let seeds = &[
                ctx.accounts.stable_coin_mint.to_account_info().key.as_ref(),
                constants::STABLE_COIN_PDA_SEED.as_ref(),
                &[_stable_nonce]
            ];
            let signer = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.stable_coin_vault.to_account_info(),
                    to: ctx.accounts.lender_stable_coin_vault.to_account_info(),
                    authority: ctx.accounts.stable_coin_vault.to_account_info(),
                },
                signer,
            );
            token::transfer(cpi_ctx, order.additional_collateral)?;
        }

        //Save Info
        config.total_additional_collateral -= order.additional_collateral;

        emit!(LiquidityOrderEvent {
            order_key: *order.to_account_info().key,
            borrower: *ctx.accounts.borrower.to_account_info().key,
            lender: *ctx.accounts.lender.to_account_info().key,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
    init,
    payer = signer,
    seeds = [constants::CONFIG_PDA_SEED.as_ref()],
    bump
    )]
    pub configuration: Box<Account<'info, Configuration>>,

    #[account(
    address = token_constants::USDC_MINT_PUBKEY.parse::< Pubkey > ().unwrap(),
    )]
    pub stable_coin_mint: Box<Account<'info, Mint>>,

    #[account(
    init,
    payer = signer,
    token::mint = stable_coin_mint,
    token::authority = stable_coin_vault,
    seeds = [token_constants::USDC_MINT_PUBKEY.parse::< Pubkey > ().unwrap().as_ref(), constants::STABLE_COIN_PDA_SEED.as_ref()],
    bump
    )]
    pub stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    constraint = fee_coin_vault.mint == stable_coin_mint.key(),
    )]
    pub fee_coin_vault: Box<Account<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(_config_nonce: u8)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
    mut,
    seeds = [constants::CONFIG_PDA_SEED.as_ref()],
    bump = _config_nonce,
    constraint = configuration.owner == signer.key() @ ErrorCode::PermissionError,
    )]
    pub configuration: Box<Account<'info, Configuration>>,

    #[account(
    address = token_constants::USDC_MINT_PUBKEY.parse::< Pubkey > ().unwrap(),
    )]
    pub stable_coin_mint: Box<Account<'info, Mint>>,

    #[account(
    constraint = fee_coin_vault.mint == stable_coin_mint.key(),
    )]
    pub fee_coin_vault: Box<Account<'info, TokenAccount>>,
}

#[derive(Accounts)]
#[instruction(_stable_nonce: u8)]
pub struct CreateOrder<'info> {
    #[account(
    mut,
    has_one = stable_coin_vault,
    has_one = stable_coin_mint,
    has_one = fee_coin_vault,
    seeds = [constants::CONFIG_PDA_SEED.as_ref()],
    bump = config.nonce,
    )]
    pub config: Box<Account<'info, Configuration>>,

    #[account(
    constraint = stable_coin_mint.key().as_ref() == config.stable_coin_mint.as_ref(),
    )]
    pub stable_coin_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = stable_coin_vault.key().as_ref() == config.stable_coin_vault.as_ref(),
    constraint = stable_coin_vault.mint == stable_coin_mint.key(),
    seeds = [stable_coin_mint.key().as_ref(), constants::STABLE_COIN_PDA_SEED.as_ref()],
    bump = _stable_nonce,
    )]
    pub stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = fee_coin_vault.key().as_ref() == config.fee_coin_vault.as_ref(),
    constraint = fee_coin_vault.mint == stable_coin_mint.key(),
    )]
    pub fee_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = user_stable_coin_vault.mint == stable_coin_mint.key(),
    constraint = user_stable_coin_vault.owner == borrower.key(),
    )]
    pub user_stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    constraint = nft_mint.supply == 1,
    constraint = nft_mint.decimals == 0,
    )]
    pub nft_mint: Box<Account<'info, Mint>>,

    #[account(
    init,
    payer = borrower,
    token::mint = nft_mint,
    token::authority = nft_vault,
    seeds = [nft_mint.key().as_ref(), constants::NFT_PDA_SEED.as_ref()],
    bump,
    )]
    pub nft_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = user_nft_vault.mint == nft_mint.key(),
    constraint = user_nft_vault.owner == borrower.key(),
    )]
    pub user_nft_vault: Box<Account<'info, TokenAccount>>,
    // Order.
    #[account(
    init_if_needed,
    payer = borrower,
    seeds = [
    config.order_id.to_string().as_ref(),
    constants::ORDER_PDA_SEED.as_ref(),
    ],
    bump
    )]
    pub order: Box<Account<'info, Order>>,

    #[account(mut)]
    pub borrower: Signer<'info>,

    // misc
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(_order_id: u64, _stable_nonce: u8, _nft_nonce: u8)]
pub struct CancelOrder<'info> {
    #[account(
    mut,
    has_one = stable_coin_vault,
    has_one = stable_coin_mint,
    seeds = [constants::CONFIG_PDA_SEED.as_ref()],
    bump = config.nonce,
    )]
    pub config: Box<Account<'info, Configuration>>,

    // Order.
    #[account(
    mut,
    constraint = order.stable_coin_vault == stable_coin_vault.key(),
    constraint = order.borrower == borrower.key(),
    constraint = order.nft_vault == nft_vault.key(),
    constraint = order.nft_mint == nft_mint.key(),
    seeds = [
    _order_id.to_string().as_ref(),
    constants::ORDER_PDA_SEED.as_ref(),
    ],
    close = borrower,
    bump = order.nonce
    )]
    pub order: Box<Account<'info, Order>>,

    #[account(
    constraint = stable_coin_mint.key().as_ref() == config.stable_coin_mint.as_ref(),
    )]
    pub stable_coin_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = stable_coin_vault.key().as_ref() == config.stable_coin_vault.as_ref(),
    constraint = stable_coin_vault.mint == stable_coin_mint.key(),
    seeds = [stable_coin_mint.key().as_ref(), constants::STABLE_COIN_PDA_SEED.as_ref()],
    bump = _stable_nonce,
    )]
    pub stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = user_stable_coin_vault.mint == stable_coin_mint.key(),
    constraint = user_stable_coin_vault.owner == borrower.key(),
    )]
    pub user_stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    constraint = nft_mint.supply == 1,
    constraint = nft_mint.decimals == 0,
    constraint = order.nft_mint == nft_mint.key(),
    )]
    pub nft_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = order.nft_vault == nft_vault.key(),
    constraint = nft_vault.mint == nft_mint.key(),
    seeds = [nft_mint.key().as_ref(), constants::NFT_PDA_SEED.as_ref()],
    bump = _nft_nonce,
    )]
    pub nft_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = user_nft_vault.mint == nft_mint.key(),
    constraint = user_nft_vault.owner == borrower.key(),
    )]
    pub user_nft_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub borrower: Signer<'info>,

    // misc
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}


#[derive(Accounts)]
#[instruction(_order_id: u64, _stable_nonce: u8)]
pub struct GiveLoan<'info> {
    #[account(
    mut,
    has_one = stable_coin_vault,
    has_one = stable_coin_mint,
    has_one = fee_coin_vault,
    seeds = [constants::CONFIG_PDA_SEED.as_ref()],
    bump = config.nonce,
    )]
    pub config: Box<Account<'info, Configuration>>,

    // Order.
    #[account(
    mut,
    constraint = order.stable_coin_vault == stable_coin_vault.key(),
    constraint = order.borrower != lender.key(),
    seeds = [
    _order_id.to_string().as_ref(),
    constants::ORDER_PDA_SEED.as_ref(),
    ],
    bump = order.nonce
    )]
    pub order: Box<Account<'info, Order>>,

    #[account(
    constraint = stable_coin_mint.key().as_ref() == config.stable_coin_mint.as_ref(),
    )]
    pub stable_coin_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = stable_coin_vault.key().as_ref() == config.stable_coin_vault.as_ref(),
    constraint = stable_coin_vault.mint == stable_coin_mint.key(),
    seeds = [stable_coin_mint.key().as_ref(), constants::STABLE_COIN_PDA_SEED.as_ref()],
    bump = _stable_nonce,
    )]
    pub stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = fee_coin_vault.key().as_ref() == config.fee_coin_vault.as_ref(),
    constraint = fee_coin_vault.mint == stable_coin_mint.key(),
    )]
    pub fee_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = lender_stable_coin_vault.mint == stable_coin_mint.key(),
    constraint = lender_stable_coin_vault.owner == lender.key(),
    )]
    pub lender_stable_coin_vault: Box<Account<'info, TokenAccount>>,
    #[account(
    mut,
    constraint = borrower_stable_coin_vault.mint == stable_coin_mint.key(),
    constraint = borrower_stable_coin_vault.owner == order.borrower,
    )]
    pub borrower_stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub lender: Signer<'info>,

    // misc
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(_order_id: u64, _stable_nonce: u8, _nft_nonce: u8)]
pub struct Payback<'info> {
    #[account(
    mut,
    has_one = stable_coin_vault,
    has_one = stable_coin_mint,
    seeds = [constants::CONFIG_PDA_SEED.as_ref()],
    bump = config.nonce,
    )]
    pub config: Box<Account<'info, Configuration>>,

    // Order.
    #[account(
    mut,
    constraint = order.stable_coin_vault == stable_coin_vault.key(),
    constraint = order.borrower == borrower.key(),
    constraint = order.nft_vault == nft_vault.key(),
    constraint = order.nft_mint == nft_mint.key(),
    seeds = [
    _order_id.to_string().as_ref(),
    constants::ORDER_PDA_SEED.as_ref(),
    ],
    close = borrower,
    bump = order.nonce
    )]
    pub order: Box<Account<'info, Order>>,

    #[account(
    constraint = stable_coin_mint.key().as_ref() == config.stable_coin_mint.as_ref(),
    )]
    pub stable_coin_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = stable_coin_vault.key().as_ref() == config.stable_coin_vault.as_ref(),
    constraint = stable_coin_vault.mint == stable_coin_mint.key(),
    seeds = [stable_coin_mint.key().as_ref(), constants::STABLE_COIN_PDA_SEED.as_ref()],
    bump = _stable_nonce,
    )]
    pub stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = lender_stable_coin_vault.mint == stable_coin_mint.key(),
    constraint = lender_stable_coin_vault.owner == order.lender,
    )]
    pub lender_stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = borrower_stable_coin_vault.mint == stable_coin_mint.key(),
    constraint = borrower_stable_coin_vault.owner == borrower.key(),
    )]
    pub borrower_stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    constraint = nft_mint.supply == 1,
    constraint = nft_mint.decimals == 0,
    constraint = order.nft_mint == nft_mint.key(),
    )]
    pub nft_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = order.nft_vault == nft_vault.key(),
    constraint = nft_vault.mint == nft_mint.key(),
    seeds = [nft_mint.key().as_ref(), constants::NFT_PDA_SEED.as_ref()],
    bump = _nft_nonce,
    )]
    pub nft_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = borrower_nft_vault.mint == nft_mint.key(),
    constraint = borrower_nft_vault.owner == borrower.key(),
    )]
    pub borrower_nft_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub borrower: Signer<'info>,

    // misc
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(_order_id: u64, _stable_nonce: u8, _nft_nonce: u8)]
pub struct Liquidate<'info> {
    #[account(
    mut,
    has_one = stable_coin_vault,
    has_one = stable_coin_mint,
    seeds = [constants::CONFIG_PDA_SEED.as_ref()],
    bump = config.nonce,
    )]
    pub config: Box<Account<'info, Configuration>>,

    // Order.
    #[account(
    mut,
    constraint = order.stable_coin_vault == stable_coin_vault.key(),
    constraint = order.lender == lender.key(),
    constraint = order.borrower == borrower.key(),
    constraint = order.nft_vault == nft_vault.key(),
    constraint = order.nft_mint == nft_mint.key(),
    seeds = [
    _order_id.to_string().as_ref(),
    constants::ORDER_PDA_SEED.as_ref(),
    ],
    close = borrower,
    bump = order.nonce
    )]
    pub order: Box<Account<'info, Order>>,

    #[account(
    constraint = stable_coin_mint.key().as_ref() == config.stable_coin_mint.as_ref(),
    )]
    pub stable_coin_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = stable_coin_vault.key().as_ref() == config.stable_coin_vault.as_ref(),
    constraint = stable_coin_vault.mint == stable_coin_mint.key(),
    seeds = [stable_coin_mint.key().as_ref(), constants::STABLE_COIN_PDA_SEED.as_ref()],
    bump = _stable_nonce,
    )]
    pub stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = lender_stable_coin_vault.mint == stable_coin_mint.key(),
    constraint = lender_stable_coin_vault.owner == lender.key(),
    )]
    pub lender_stable_coin_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    constraint = nft_mint.supply == 1,
    constraint = nft_mint.decimals == 0,
    constraint = order.nft_mint == nft_mint.key(),
    )]
    pub nft_mint: Box<Account<'info, Mint>>,

    #[account(
    mut,
    constraint = order.nft_vault == nft_vault.key(),
    constraint = nft_vault.mint == nft_mint.key(),
    seeds = [nft_mint.key().as_ref(), constants::NFT_PDA_SEED.as_ref()],
    bump = _nft_nonce,
    )]
    pub nft_vault: Box<Account<'info, TokenAccount>>,

    #[account(
    mut,
    constraint = lender_nft_vault.mint == nft_mint.key(),
    constraint = lender_nft_vault.owner == lender.key(),
    )]
    pub lender_nft_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    /// CHECK: back to borrower
    pub borrower: AccountInfo<'info>,

    #[account(mut)]
    pub lender: Signer<'info>,

    // misc
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(Default)]
pub struct Configuration {
    pub owner: Pubkey,
    /// Mint of the token
    pub stable_coin_mint: Pubkey,
    /// Vault holding the stablecoins -- mostly for holding the collateral stablecoins
    pub stable_coin_vault: Pubkey,
    /// Vault fee the stablecoins -- mostly for receive the service fee
    pub fee_coin_vault: Pubkey,
    /// latest order id
    pub order_id: u64,
    /// total additional collateral
    pub total_additional_collateral: u64,
    /// nonce
    pub nonce: u8,
}

#[account]
#[derive(Default)]
pub struct Order {
    /// person requesting the loan
    pub borrower: Pubkey,
    /// vault to send the loan
    pub stable_coin_vault: Pubkey,
    /// mint of the nft
    pub nft_mint: Pubkey,
    /// collateral vault holding the nft
    pub nft_vault: Pubkey,
    /// request amount
    pub request_amount: u64,
    /// interest amount
    pub interest: u64,
    /// payback amoumt
    pub payback_amount: u64,
    /// fee amoumt
    pub fee_amount: u64,
    /// the loan period
    pub period: u64,
    /// additional collateral
    pub additional_collateral: u64,
    /// lender
    pub lender: Pubkey,
    /// order created at
    pub created_at: u64,
    /// loan start time
    pub loan_start_time: u64,
    /// repayment timestamp
    pub paid_back_at: u64,
    /// time the lender liquidated the loan & withdrew the collateral
    pub withdrew_at: u64,
    /// status of the order
    pub order_status: bool,
    /// order id
    pub order_id: u64,
    /// nonce
    pub nonce: u8,
}


#[error_code]
pub enum ErrorCode {
    #[msg("Loan has started or already been canceled")]
    LoanAlreadyStarted,
    #[msg("Loan not provided yet")]
    LoanNotProvided,
    #[msg("Repayment Period has been exceeded")]
    RepaymentPeriodExceeded,
    #[msg("Repayment Period has not been exceeded")]
    RepaymentPeriodNotExceeded,
    #[msg("Already liquidated")]
    AlreadyLiquidated,
    #[msg("Invalid action, E5000")]
    PermissionError,
}

/**
* **************************************
* Notice from Function
* **************************************
*/
/// @notice Create Order Function
#[event]
pub struct CreatedOrderEvent {
    pub order_key: Pubkey,
    pub borrower: Pubkey,
}

/// @notice Canceled Order Function
#[event]
pub struct CanceledOrderEvent {
    pub order_key: Pubkey,
    pub borrower: Pubkey,
}
/// @notice Loan Order Function
#[event]
pub struct LoanOrderEvent {
    pub order_key: Pubkey,
    pub borrower: Pubkey,
    pub lender: Pubkey,
}
/// @notice Payback Order Function
#[event]
pub struct PayBackOrderEvent {
    pub order_key: Pubkey,
    pub borrower: Pubkey,
}
/// @notice Liquidity Order Function
#[event]
pub struct LiquidityOrderEvent {
    pub order_key: Pubkey,
    pub borrower: Pubkey,
    pub lender: Pubkey,
}
