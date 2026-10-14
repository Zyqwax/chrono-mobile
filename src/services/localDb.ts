import * as SQLite from 'expo-sqlite';
import { Message, MessageReply, User } from '../types';

interface MessageRow {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
  createdTimestamp: number;
  replyToId: string | null;
  replyTo: string | null;
  sender: string;
  editedAt: string | null;
  deletedAt: string | null;
  isPending: number;
}

class LocalDatabase {
  private dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private isInitialized = false;

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const db = await SQLite.openDatabaseAsync('chrono_local.db');
        if (!this.isInitialized) {
          // Performans ve eşzamanlılık için WAL modu
          await db.execAsync('PRAGMA journal_mode = WAL;');
          await db.execAsync(`
            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY NOT NULL,
              roomId TEXT NOT NULL,
              senderId TEXT NOT NULL,
              content TEXT,
              type TEXT NOT NULL DEFAULT 'TEXT',
              createdAt TEXT NOT NULL,
              createdTimestamp INTEGER NOT NULL,
              replyToId TEXT,
              replyTo TEXT,
              sender TEXT NOT NULL,
              editedAt TEXT,
              deletedAt TEXT,
              isPending INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_messages_room_ts 
            ON messages(roomId, createdTimestamp DESC);

            CREATE INDEX IF NOT EXISTS idx_messages_created_ts 
            ON messages(createdTimestamp DESC);
          `);
          this.isInitialized = true;
        }
        return db;
      })();
    }
    return this.dbPromise;
  }

  /**
   * Bir veritabanı satırını Message nesnesine dönüştürür.
   */
  private rowToMessage(row: MessageRow): Message {
    let parsedSender: User = {
      id: row.senderId,
      email: '',
      username: 'Kullanıcı',
      displayName: 'Kullanıcı',
    };
    try {
      if (row.sender) {
        parsedSender = JSON.parse(row.sender);
      }
    } catch {
      // yut
    }

    let parsedReplyTo: MessageReply | null = null;
    try {
      if (row.replyTo) {
        parsedReplyTo = JSON.parse(row.replyTo);
      }
    } catch {
      // yut
    }

    return {
      id: row.id,
      roomId: row.roomId,
      senderId: row.senderId,
      content: row.content,
      type: (row.type as any) || 'TEXT',
      createdAt: row.createdAt,
      replyToId: row.replyToId,
      replyTo: parsedReplyTo,
      sender: parsedSender,
      editedAt: row.editedAt,
      deletedAt: row.deletedAt,
      isPending: Boolean(row.isPending),
    };
  }

  /**
   * Belirtilen odadaki mesajları yerel SQLite'tan en yeniden en eskiye sıralı getirir.
   */
  async getMessages(
    roomId: string,
    limit = 50,
    beforeTimestamp?: number,
  ): Promise<Message[]> {
    try {
      const db = await this.getDb();
      let query = `
        SELECT * FROM messages 
        WHERE roomId = ? 
      `;
      const params: (string | number)[] = [roomId];

      if (beforeTimestamp !== undefined) {
        query += ' AND createdTimestamp < ? ';
        params.push(beforeTimestamp);
      }

      query += ' ORDER BY createdTimestamp DESC LIMIT ?; ';
      params.push(limit);

      const rows = await db.getAllAsync<MessageRow>(query, params);
      return rows.map((r) => this.rowToMessage(r));
    } catch (error) {
      console.warn('LocalDb getMessages hatası:', error);
      return [];
    }
  }

  /**
   * Belirtilen odadaki en son mesajı getirir (Senkronizasyon fark sorgusu için kullanılır).
   */
  async getLatestMessage(roomId: string): Promise<Message | null> {
    try {
      const db = await this.getDb();
      const row = await db.getFirstAsync<MessageRow>(
        'SELECT * FROM messages WHERE roomId = ? ORDER BY createdTimestamp DESC LIMIT 1;',
        [roomId],
      );
      return row ? this.rowToMessage(row) : null;
    } catch (error) {
      console.warn('LocalDb getLatestMessage hatası:', error);
      return null;
    }
  }

  /**
   * Tek bir mesajı yerel veritabanına ekler veya günceller (Upsert).
   */
  async saveMessage(message: Message): Promise<void> {
    try {
      const db = await this.getDb();
      const createdTimestamp = new Date(message.createdAt).getTime() || Date.now();
      const senderJson = JSON.stringify(message.sender || {});
      const replyToJson = message.replyTo ? JSON.stringify(message.replyTo) : null;

      await db.runAsync(
        `INSERT OR REPLACE INTO messages (
          id, roomId, senderId, content, type, createdAt, createdTimestamp,
          replyToId, replyTo, sender, editedAt, deletedAt, isPending
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          message.id,
          message.roomId,
          message.senderId,
          message.content ?? '',
          message.type || 'TEXT',
          message.createdAt,
          createdTimestamp,
          message.replyToId || null,
          replyToJson,
          senderJson,
          message.editedAt || null,
          message.deletedAt || null,
          message.isPending ? 1 : 0,
        ],
      );
    } catch (error) {
      console.warn('LocalDb saveMessage hatası:', error);
    }
  }

  /**
   * Birden fazla mesajı tek bir SQLite işlemi (transaction) içinde toplu kaydeder.
   */
  async saveMessages(messages: Message[]): Promise<void> {
    if (!messages || messages.length === 0) return;
    try {
      const db = await this.getDb();
      await db.withTransactionAsync(async () => {
        for (const message of messages) {
          const createdTimestamp =
            new Date(message.createdAt).getTime() || Date.now();
          const senderJson = JSON.stringify(message.sender || {});
          const replyToJson = message.replyTo
            ? JSON.stringify(message.replyTo)
            : null;

          await db.runAsync(
            `INSERT OR REPLACE INTO messages (
              id, roomId, senderId, content, type, createdAt, createdTimestamp,
              replyToId, replyTo, sender, editedAt, deletedAt, isPending
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              message.id,
              message.roomId,
              message.senderId,
              message.content ?? '',
              message.type || 'TEXT',
              message.createdAt,
              createdTimestamp,
              message.replyToId || null,
              replyToJson,
              senderJson,
              message.editedAt || null,
              message.deletedAt || null,
              message.isPending ? 1 : 0,
            ],
          );
        }
      });
    } catch (error) {
      console.warn('LocalDb saveMessages toplu kayıt hatası:', error);
    }
  }

  /**
   * Mesaj içeriğini günceller (Düzenleme durumunda).
   */
  async updateMessageContent(
    messageId: string,
    content: string,
    editedAt?: string,
  ): Promise<void> {
    try {
      const db = await this.getDb();
      await db.runAsync(
        'UPDATE messages SET content = ?, editedAt = ? WHERE id = ?;',
        [content, editedAt || new Date().toISOString(), messageId],
      );
    } catch (error) {
      console.warn('LocalDb updateMessageContent hatası:', error);
    }
  }

  /**
   * Mesajı silindi olarak işaretler veya veritabanından kaldırır.
   */
  async deleteMessage(messageId: string, softDelete = true): Promise<void> {
    try {
      const db = await this.getDb();
      if (softDelete) {
        await db.runAsync(
          'UPDATE messages SET deletedAt = ? WHERE id = ?;',
          [new Date().toISOString(), messageId],
        );
      } else {
        await db.runAsync('DELETE FROM messages WHERE id = ?;', [messageId]);
      }
    } catch (error) {
      console.warn('LocalDb deleteMessage hatası:', error);
    }
  }

  /**
   * Bir odadaki tüm mesajları temizler (Sohbeti temizle işleminde).
   */
  async clearRoomMessages(roomId: string): Promise<void> {
    try {
      const db = await this.getDb();
      await db.runAsync('DELETE FROM messages WHERE roomId = ?;', [roomId]);
    } catch (error) {
      console.warn('LocalDb clearRoomMessages hatası:', error);
    }
  }

  /**
   * Ana sohbet listesinde her odanın en son mesajını 0 ms'de getirmek için harita döndürür.
   */
  async getLatestMessagesForAllRooms(): Promise<Record<string, Message>> {
    try {
      const db = await this.getDb();
      // Her odanın en yüksek createdTimestamp'e sahip satırı
      const query = `
        SELECT m.* FROM messages m
        INNER JOIN (
          SELECT roomId, MAX(createdTimestamp) as maxTs
          FROM messages
          GROUP BY roomId
        ) latest ON m.roomId = latest.roomId AND m.createdTimestamp = latest.maxTs;
      `;
      const rows = await db.getAllAsync<MessageRow>(query);
      const result: Record<string, Message> = {};
      for (const row of rows) {
        result[row.roomId] = this.rowToMessage(row);
      }
      return result;
    } catch (error) {
      console.warn('LocalDb getLatestMessagesForAllRooms hatası:', error);
      return {};
    }
  }

  /**
   * Tüm sohbetlerde veya belirli bir odada kelime araması yapar.
   */
  async searchMessages(queryText: string, roomId?: string): Promise<Message[]> {
    try {
      const db = await this.getDb();
      let query = 'SELECT * FROM messages WHERE content LIKE ? ';
      const params: (string | number)[] = [`%${queryText}%`];

      if (roomId) {
        query += ' AND roomId = ? ';
        params.push(roomId);
      }

      query += ' ORDER BY createdTimestamp DESC LIMIT 100;';
      const rows = await db.getAllAsync<MessageRow>(query, params);
      return rows.map((r) => this.rowToMessage(r));
    } catch (error) {
      console.warn('LocalDb searchMessages hatası:', error);
      return [];
    }
  }

  /**
   * Oturum sonlandığında güvenlik amacıyla yerel veritabanındaki tüm mesajları siler.
   */
  async purgeAllData(): Promise<void> {
    try {
      const db = await this.getDb();
      await db.runAsync('DELETE FROM messages;');
    } catch (error) {
      console.warn('LocalDb purgeAllData hatası:', error);
    }
  }
}

export const localDb = new LocalDatabase();
