
use anchor_lang::prelude::*;

declare_id!("AKjkfu64ZMHs3cufaQKoZxUCZGgRYr8iiD3KDDSwndNf");

#[program]
pub mod auction_backend {
    use super::*;

    pub fn crear_subasta(
        ctx: Context<CrearSubasta>,
        id: u64,
        nombre: String,
        descripcion: String,
        importe_minimo: u64,
        fecha_inicio: i64,
        fecha_fin: i64,
    ) -> Result<()> {

        require!(fecha_fin > fecha_inicio, ErrorCode::RangoFechas);

        let subasta = &mut ctx.accounts.subasta;

        subasta.id = id;
        subasta.nombre = nombre;
        subasta.descripcion = descripcion;
        subasta.importe_minimo = importe_minimo;
        subasta.fecha_inicio = fecha_inicio;
        subasta.fecha_fin = fecha_fin;
        subasta.estado = 0;
        subasta.creador = ctx.accounts.user.key();
        subasta.ganador = Pubkey::default();
        subasta.importe_ganador = 0;

        // Create vault owned by SystemProgram (so system_instruction::transfer can withdraw from it)
        if ctx.accounts.vault.lamports() == 0 {
            let vault_bump = ctx.bumps.vault;
            let seeds: &[&[u8]] = &[
                b"vault",
                &id.to_le_bytes(),
                &[vault_bump],
            ];
            let rent = Rent::get()?;
            let lamports = rent.minimum_balance(0);
            let ix = anchor_lang::solana_program::system_instruction::create_account(
                &ctx.accounts.user.key(),
                &ctx.accounts.vault.key(),
                lamports,
                0,
                &anchor_lang::solana_program::system_program::ID,
            );
            anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &[
                    ctx.accounts.user.to_account_info(),
                    ctx.accounts.vault.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[seeds],
            )?;
        }

        Ok(())
    }

    pub fn iniciar_subasta(ctx: Context<IniciarSubasta>, _id: u64) -> Result<()> {
        let subasta = &mut ctx.accounts.subasta;

        require!(ctx.accounts.user.key() == subasta.creador, ErrorCode::NoCreador);
        require!(subasta.estado == 0, ErrorCode::YaIniciada);

        let now = Clock::get()?.unix_timestamp;
        require!(now >= subasta.fecha_inicio, ErrorCode::NoHaEmpezado);

        subasta.estado = 1;

        Ok(())
    }

    pub fn crear_puja(
        ctx: Context<CrearPuja>,
        id: u64,
        importe_puja: u64,
    ) -> Result<()> {

        let subasta = &mut ctx.accounts.subasta;

        require!(subasta.id == id, ErrorCode::IdIncorrecto);
        require!(ctx.accounts.user.key() != subasta.creador, ErrorCode::CreadorNoPuja);
        require!(subasta.estado == 1, ErrorCode::NoActiva);

        let now = Clock::get()?.unix_timestamp;

        require!(now >= subasta.fecha_inicio, ErrorCode::NoHaEmpezado);
        require!(now < subasta.fecha_fin, ErrorCode::YaFinalizo);

        require!(importe_puja >= subasta.importe_minimo, ErrorCode::PujaBaja);
        require!(importe_puja > subasta.importe_ganador, ErrorCode::PujaMenor);

        // Validar ganador anterior
        if subasta.ganador != Pubkey::default() {
            require!(
                ctx.accounts.prev_ganador.key() == subasta.ganador,
                ErrorCode::GanadorIncorrecto
            );
        }

        // ✅ 1. REFUND
        if subasta.ganador != Pubkey::default() {

            let bump = ctx.bumps.vault;
            let seeds: &[&[u8]] = &[
                b"vault",
                &id.to_le_bytes(),
                &[bump],
            ];

            let ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.vault.key(),
                &ctx.accounts.prev_ganador.key(),
                subasta.importe_ganador,
            );

            anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &[
                    ctx.accounts.vault.to_account_info(),
                    ctx.accounts.prev_ganador.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[seeds],
            )?;
        }

        // ✅ 2. COBRAR NUEVA PUJA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.vault.key(),
            importe_puja,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Update
        subasta.ganador = ctx.accounts.user.key();
        subasta.importe_ganador = importe_puja;

        let puja = &mut ctx.accounts.puja;
        puja.id = id;
        puja.user = ctx.accounts.user.key();
        puja.importe = importe_puja;
        puja.ts = now;

        Ok(())
    }

    pub fn finalizar_subasta(ctx: Context<FinalizarSubasta>, id: u64) -> Result<()> {

        let subasta = &mut ctx.accounts.subasta;

        require!(subasta.id == id, ErrorCode::IdIncorrecto);
        require!(ctx.accounts.user.key() == subasta.creador, ErrorCode::NoCreador);
        require!(subasta.estado == 1, ErrorCode::NoActiva);

        let now = Clock::get()?.unix_timestamp;
        require!(now >= subasta.fecha_fin, ErrorCode::NoTermino);

        subasta.estado = 2;

        let balance = ctx.accounts.vault.to_account_info().lamports();

        if balance > 0 {

            let bump = ctx.bumps.vault;
            let seeds: &[&[u8]] = &[
                b"vault",
                &id.to_le_bytes(),
                &[bump],
            ];

            let ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.vault.key(),
                &ctx.accounts.user.key(),
                balance,
            );

            anchor_lang::solana_program::program::invoke_signed(
                &ix,
                &[
                    ctx.accounts.vault.to_account_info(),
                    ctx.accounts.user.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[seeds],
            )?;
        }

        Ok(())
    }
}

#[account]
pub struct Subasta {
    pub id: u64,
    pub nombre: String,
    pub descripcion: String,
    pub importe_minimo: u64,
    pub fecha_inicio: i64,
    pub fecha_fin: i64,
    pub estado: u8,
    pub creador: Pubkey,
    pub ganador: Pubkey,
    pub importe_ganador: u64,
}

#[account]
pub struct Puja {
    pub id: u64,
    pub user: Pubkey,
    pub importe: u64,
    pub ts: i64,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CrearSubasta<'info> {

    #[account(
        init,
        payer = user,
        space = 8 + 200,
        seeds = [b"subasta33", id.to_le_bytes().as_ref()],
        bump
    )]
    pub subasta: Account<'info, Subasta>,

    #[account(
        mut,
        seeds = [b"vault", id.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: PDA owned by SystemProgram to hold lamports
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct IniciarSubasta<'info> {

    #[account(mut, seeds = [b"subasta33", id.to_le_bytes().as_ref()], bump)]
    pub subasta: Account<'info, Subasta>,

    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CrearPuja<'info> {

    #[account(mut, seeds = [b"subasta33", id.to_le_bytes().as_ref()], bump)]
    pub subasta: Account<'info, Subasta>,

    #[account(mut, seeds = [b"vault", id.to_le_bytes().as_ref()], bump)]
    /// CHECK: PDA para almacenar lamports
    pub vault: UncheckedAccount<'info>,

    /// CHECK: recibe reembolsos, validado contra subasta.ganador
    #[account(mut)]
    pub prev_ganador: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 64,
        seeds = [b"puja2222", id.to_le_bytes().as_ref(), user.key().as_ref()],
        bump
    )]
    pub puja: Account<'info, Puja>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct FinalizarSubasta<'info> {

    #[account(mut, seeds = [b"subasta33", id.to_le_bytes().as_ref()], bump)]
    pub subasta: Account<'info, Subasta>,

    #[account(mut, seeds = [b"vault", id.to_le_bytes().as_ref()], bump)]
    /// CHECK: PDA para almacenar lamports
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Rango de fechas invalido")]
    RangoFechas,
    #[msg("Ya iniciada")]
    YaIniciada,
    #[msg("No ha empezado")]
    NoHaEmpezado,
    #[msg("No activo")]
    NoActiva,
    #[msg("Ya finalizo")]
    YaFinalizo,
    #[msg("Puja baja")]
    PujaBaja,
    #[msg("Puja menor a actual")]
    PujaMenor,
    #[msg("No creador")]
    NoCreador,
    #[msg("No termino")]
    NoTermino,
    #[msg("ID incorrecto")]
    IdIncorrecto,
    #[msg("Ganador incorrecto")]
    GanadorIncorrecto,
    #[msg("El creador no puede pujar")]
    CreadorNoPuja,
}
