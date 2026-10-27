import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const settings=sqliteTable('settings',{id:text('id').primaryKey(),value:text('value').notNull()});
export const records=sqliteTable('records',{id:text('id').primaryKey(),credential:text('credential').notNull(),result:text('result').notNull(),created:integer('created').notNull()});
