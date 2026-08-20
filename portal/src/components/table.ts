export interface TableColumn<T> {
  header: string;
  accessor: (row: T) => string | HTMLElement;
}

export interface TableOptions<T> {
  columns: TableColumn<T>[];
  data: T[];
}

export function renderTable<T>(options: TableOptions<T>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'table-container';

  const table = document.createElement('table');
  table.className = 'table';

  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  options.columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col.header;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  options.data.forEach((row) => {
    const tr = document.createElement('tr');
    options.columns.forEach((col) => {
      const td = document.createElement('td');
      const val = col.accessor(row);
      if (typeof val === 'string') {
        td.textContent = val;
      } else {
        td.appendChild(val);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);
  return container;
}
