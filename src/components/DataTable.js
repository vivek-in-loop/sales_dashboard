import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  TablePagination,
} from "@mui/material";

function DataTable({ columns, rows, maxHeight = 420, emptyMessage = "No records" }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const slicedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Paper variant="outlined">
      {rows.length === 0 ? (
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ p: 3, textAlign: "center" }}
        >
          {emptyMessage}
        </Typography>
      ) : (
        <>
          <TableContainer sx={{ maxHeight }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {columns.map((col) => (
                    <TableCell key={col.key}>{col.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {slicedRows.map((row, idx) => (
                  <TableRow key={`${row.id || ""}-${idx}`}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        {row[col.key] != null ? String(row[col.key]) : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            rowsPerPageOptions={[10, 25, 50]}
            count={rows.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}
    </Paper>
  );
}

export default DataTable;


