import { Api } from "grammy";
import type { Messenger } from "@/core/ports";

/** Sends through the Bot API, so AI and operator messages share the bot's identity. */
export class TelegramMessenger implements Messenger {
  private readonly api: Api;

  constructor(token: string) {
    this.api = new Api(token);
  }

  async sendText(telegramChatId: number, text: string): Promise<void> {
    await this.api.sendMessage(telegramChatId, text);
  }
}
