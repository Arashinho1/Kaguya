/**
 * Erro de regra de negócio pensado para virar mensagem amigável ao usuário no Discord.
 * Os handlers de comando (messageCreate/interactionCreate) tratam DomainError de forma
 * especial: respondem com error.message em vez do log genérico de falha.
 */
export class DomainError extends Error {}
