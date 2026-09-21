import { writeFileSync } from 'node:fs';
import { genererBulletinPdf } from '../src/modules/paie/paie.pdf';

const id = process.argv[2];
const buffer = await genererBulletinPdf(id);
const texte = buffer.toString('latin1');
const nbPages = (texte.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
console.log(`Taille du PDF : ${buffer.length} octets`);
console.log(`Nombre de pages détectées : ${nbPages}`);
if (process.argv[3]) {
  writeFileSync(process.argv[3], buffer);
  console.log(`Écrit dans ${process.argv[3]}`);
}
process.exit(0);
