import pgp from "pg-promise"
import dotenv from 'dotenv';
dotenv.config();

const pgInit = pgp();  //pgp needs to be initialized here
const db = pgInit( `postgres://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@localhost:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`)

export default db