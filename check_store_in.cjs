const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) {
        envVars[key.trim()] = rest.join('=').trim().replace(/^['"]+|['"]+$/g, '');
    }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('store_in').select('id, billAmount');
  data.forEach(row => {
     if (row.billAmount && String(row.billAmount).split('.')[1]?.length > 2) {
       console.log(row.id, row.billAmount);
     }
  });
}
run();
