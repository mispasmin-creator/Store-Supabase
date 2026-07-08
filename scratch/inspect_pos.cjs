const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://uayzjufjncmvszutiboc.supabase.co";
const supabaseAnonKey = "sb_publishable_tv7fGzNxIXQuFD7uJ5OcGQ_IY63AIX3";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const poNumbers = ['STORE-PO-25-26-95'];

async function run() {
  console.log('--- PO MASTER RECORDS ---');
  const { data: poMaster, error: err1 } = await supabase
    .from('po_master')
    .select('po_number, internal_code, product, quantity, rate, gst, discount, amount, total_po_amount, packaging, forwarding')
    .in('po_number', poNumbers);
  
  if (err1) console.error('Error po_master:', err1);
  else console.log(JSON.stringify(poMaster, null, 2));

  console.log('--- INDENT RECORDS ---');
  const { data: indent, error: err2 } = await supabase
    .from('indent')
    .select('po_number, indent_number, product_name, quantity, approved_quantity, approved_rate, tax_value4, with_tax_or_not4, planned5, actual5, lifting_status')
    .in('po_number', poNumbers);

  if (err2) console.error('Error indent:', err2);
  else console.log(JSON.stringify(indent, null, 2));
}

run();
