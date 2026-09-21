import { calculerEtEnregistrerBulletin } from '../src/modules/paie/paie';

const employeId = process.argv[2];
const periode = process.argv[3] ?? '2026-09-01';
const bulletin = await calculerEtEnregistrerBulletin({ employeId, periode });
console.log(bulletin.id);
process.exit(0);
