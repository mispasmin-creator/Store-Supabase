const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://uayzjufjncmvszutiboc.supabase.co";
const supabaseAnonKey = "sb_publishable_tv7fGzNxIXQuFD7uJ5OcGQ_IY63AIX3";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("--- Querying column names of the issue table ---");
  // We can query the RPC or use postgrest to run a select limit 0 or a catalog query
  // Let's query catalog using an RPC if possible, or select one record and see all its keys including nulls.
  // Actually, standard select '*' returns all columns, even if null. But let's verify if there is any column.
  
  const { data, error } = await supabase
    .from('issue')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Record keys:', Object.keys(data[0] || {}));
    console.log('Entire first record:', data[0]);
  }
}

run();
