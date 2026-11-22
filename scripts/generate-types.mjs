import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
const envFile=new URL('../.env.local',import.meta.url);
if(existsSync(envFile)) process.loadEnvFile(envFile);
const project=process.env.SUPABASE_PROJECT_ID;
if(!project) {console.error('Set SUPABASE_PROJECT_ID from your isolated Finanion project.');process.exit(1);}
try {
 const output=execFileSync('npx',['--yes','supabase','gen','types',`--remote=${project}`,'--schema','public'],{encoding:'utf8',stdio:['inherit','pipe','inherit']});
 writeFileSync(new URL('../src/types/database.generated.ts',import.meta.url),output);
 console.log('Wrote src/types/database.generated.ts');
} catch(error) {console.error('Type generation failed. Authenticate Supabase CLI and apply migrations first.');process.exit(error.status||1);}
