import * as React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TableSortLabel,
    Checkbox,
    IconButton,
    Tooltip,
    Typography,
    Box,
} from '@mui/material';
import { MdDelete, MdEdit } from 'react-icons/md';

const TableWCheck = ({ data = [
    { name: 'John Doe', age: 28 },
    { name: 'Jane Smith', age: 34 },
    { name: 'Albert Johnson', age: 45 },
    { name: 'Lisa Adams', age: 23 },
    { name: 'Peter Brown', age: 38 },
    { name: 'Rachel Green', age: 30 },
] }) => {
    const [order, setOrder] = React.useState('asc');
    const [orderBy, setOrderBy] = React.useState('name');
    const [selected, setSelected] = React.useState([]);

    // Sorting handler
    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    // Checkbox selection handler
    const handleSelectAllClick = (event) => {
        if (event.target.checked) {
            const newSelecteds = data.map((n) => n.name);
            setSelected(newSelecteds);
            return;
        }
        setSelected([]);
    };

    const handleClick = (name) => {
        const selectedIndex = selected.indexOf(name);
        let newSelected = [];

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selected, name);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selected.slice(1));
        } else if (selectedIndex === selected.length - 1) {
            newSelected = newSelected.concat(selected.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selected.slice(0, selectedIndex),
                selected.slice(selectedIndex + 1)
            );
        }

        setSelected(newSelected);
    };

    const isSelected = (name) => selected.indexOf(name) !== -1;

    // Sorting function
    const sortedData = React.useMemo(() => {
        return [...data].sort((a, b) => {
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
                        <TableCell padding="checkbox">
                            <Checkbox
                                color="primary"
                                indeterminate={selected.length > 0 && selected.length < data.length}
                                checked={data.length > 0 && selected.length === data.length}
                                onChange={handleSelectAllClick}
                            />
                        </TableCell>
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
                            <TableCell colSpan={4} align="center">
                                <Typography variant="body1" color="textSecondary">
                                    No entries available.
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedData.map((row) => {
                            const isItemSelected = isSelected(row.name);
                            return (
                                <TableRow
                                    key={row.name}
                                    selected={isItemSelected}
                                    hover
                                    onClick={() => handleClick(row.name)}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            color="primary"
                                            checked={isItemSelected}
                                            onChange={() => handleClick(row.name)}
                                        />
                                    </TableCell>
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
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default TableWCheck;
