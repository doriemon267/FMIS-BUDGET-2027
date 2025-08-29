import { Paper, Table, TableBody, TableContainer, TableCell, TableRow } from '@mui/material';
import React from 'react';

const TableLoading = ({ numRow = 17, numCell = 8 }) => {
    const rows = Array.from({ length: numRow }, (_, index) => index + 1);
    const cells = Array.from({ length: numCell }, (_, index) => index + 1);
    const getRandomDuration = () => {
        // Generate a random duration between 0.5s and 1.5s
        return `${Math.random() * (1.5 - 0.5) + 0.5}s`;
    };
    return (
        <TableContainer component={Paper}>
            <Table size='small'>
                <TableBody>
                    {rows.map((v) => (
                        <TableRow className="fade-in" key={v}>
                            {
                                cells.map(num => (
                                    <TableCell
                                        key={num}
                                        className='loading-cell'
                                        sx={{
                                            animationDuration: getRandomDuration(),
                                            py: 3.2,
                                            border: '2px solid white',
                                        }} />
                                ))
                            }
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default TableLoading;