import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'frontend','node_modules');
const report=[];
function visit(folder){
  for(const name of fs.readdirSync(folder)){
    if(name.startsWith('.'))continue;
    const location=path.join(folder,name);
    if(!fs.statSync(location).isDirectory())continue;
    if(name.startsWith('@')){visit(location);continue;}
    const manifest=path.join(location,'package.json');
    if(fs.existsSync(manifest)){
      const data=JSON.parse(fs.readFileSync(manifest,'utf8'));
      report.push({name:data.name,version:data.version,license:data.license||'See package license file'});
    }
    const nested=path.join(location,'node_modules');if(fs.existsSync(nested))visit(nested);
  }
}
visit(directory);fs.mkdirSync(path.join(root,'docs'),{recursive:true});
fs.writeFileSync(path.join(root,'docs','frontend-licenses.json'),JSON.stringify(report.sort((a,b)=>a.name.localeCompare(b.name)),null,2)+'\n');
console.log(`Recorded installed license metadata for ${report.length} frontend packages.`);
