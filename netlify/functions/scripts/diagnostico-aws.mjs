import { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } from '@aws-sdk/client-sts'

const id = process.env.MS_AWS_ACCESS_KEY_ID ?? ''
const secret = process.env.MS_AWS_SECRET_ACCESS_KEY ?? ''

console.log('accessKeyId: longitud', id.length, '(debe ser 20)')
console.log('  empieza con AKIA:', id.startsWith('AKIA'))
console.log('  sin espacios:', id === id.trim())
console.log('secretAccessKey: longitud', secret.length, '(debe ser 40)')
console.log('  sin espacios:', secret === secret.trim())
console.log('  sin comillas:', !/["\']/.test(secret))

const credentials = { accessKeyId: id, secretAccessKey: secret }
const sts = new STSClient({ region: process.env.MS_AWS_REGION, credentials })

console.log('\n1. Identidad de la credencial base...')
const yo = await sts.send(new GetCallerIdentityCommand({}))
console.log('   ', yo.Arn)

console.log('\n2. Asumiendo el rol...')
const r = await sts.send(new AssumeRoleCommand({
  RoleArn: process.env.MS_AWS_ROLE_ARN,
  RoleSessionName: 'diagnostico',
  ExternalId: process.env.MS_AWS_ROLE_EXTERNAL_ID,
}))
console.log('   ', r.AssumedRoleUser.Arn)