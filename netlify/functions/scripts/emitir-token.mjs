import { issueSession } from '../_lib/session.js'

const { token, expiresAt } = await issueSession(process.argv[2])
console.log(token)
console.error('Expira:', expiresAt)   // a stderr, para no ensuciar el token