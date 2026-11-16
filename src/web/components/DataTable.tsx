import 'datatables.net-dt/css/dataTables.dataTables.css';
import DataTable from 'datatables.net-react';
import type { DataTableProps } from 'datatables.net-react';
import DT from 'datatables.net-dt';

// Registers the DataTables core once for every page that imports this module.
// `use` is the library's registration method, not a React hook (false positive for rules-of-hooks).
// oxlint-disable-next-line react-hooks/rules-of-hooks
DataTable.use(DT);

export type DataTableOptions = NonNullable<DataTableProps['options']>;
export type DataTableColumns = NonNullable<DataTableProps['columns']>;

export { DataTable };
