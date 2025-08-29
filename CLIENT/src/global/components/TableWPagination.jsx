import { MdDelete } from 'react-icons/md';
import { MdEdit } from 'react-icons/md';

import * as React from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    TablePagination, TableSortLabel, IconButton, Tooltip
} from '@mui/material';

const TableWPagination = ({ data = [
    { name: 'John Doe', age: 28 },
    { name: 'Jane Smith', age: 34 },
    { name: 'Albert Johnson', age: 45 },
    { name: 'Lisa Adams', age: 23 },
    { name: 'Peter Brown', age: 38 },
    { name: 'Rachel Green', age: 30 },
] }) => {
    const [order, setOrder] = React.useState('asc');
    const [orderBy, setOrderBy] = React.useState('name');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);

    // Sorting handler
    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    // Pagination handlers
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0); // Reset page when rows per page changes
    };

    // Sorting function
    const sortedData = React.useMemo(() => {
        return data.sort((a, b) => {
            if (orderBy === 'name') {
                return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            } else if (orderBy === 'age') {
                return order === 'asc' ? a.age - b.age : b.age - a.age;
            }
            return 0;
        });
    }, [data, order, orderBy]);

    return (
        <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
            <Table size='small'>
                <TableHead>
                    <TableRow>
                        <TableCell>
                            <TableSortLabel
                                active={orderBy === 'name'}
                                direction={orderBy === 'name' ? order : 'asc'}
                                onClick={() => handleRequestSort('name')}
                            >
                                Name
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="right">
                            <TableSortLabel
                                active={orderBy === 'age'}
                                direction={orderBy === 'age' ? order : 'asc'}
                                onClick={() => handleRequestSort('age')}
                            >
                                Age
                            </TableSortLabel>
                        </TableCell>
                        <TableCell align="right">Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3} align="center">
                                <Typography variant="body1" color="textSecondary">
                                    No entries available.
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedData.map((row) => (
                            <TableRow key={row.name} hover>
                                <TableCell component="th" scope="row">
                                    {row.name}
                                </TableCell>
                                <TableCell align="right">{row.age}</TableCell>
                                <TableCell align="right">
                                    <Tooltip title="Edit">
                                        <IconButton color="primary">
                                            <MdEdit />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton color="secondary">
                                            <MdDelete />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            <TablePagination
                component="div"
                count={data.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />
        </TableContainer>
    );
};

export default TableWPagination;
