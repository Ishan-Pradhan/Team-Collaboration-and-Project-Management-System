import bcrypt from "bcryptjs"
import crypto from "crypto"

export const hashPassword = (password: string) => bcrypt.hash(password, 10)
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash)
export const generateToken = () => crypto.randomBytes(32).toString("hex")