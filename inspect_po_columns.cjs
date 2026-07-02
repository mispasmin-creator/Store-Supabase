const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://uayzjufjncmvszutiboc.supabase.co";
const supabaseAnonKey = "sb_publishable_tv7fGzNxIXQuFD7uJ5OcGQ_IY63AIX3";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: records, error } = await supabase
    .from('po_master')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching po_master row:', error);
  } else {
    console.log('--- PO Master columns ---');
    console.log(records[0]);
  }
}

run();
