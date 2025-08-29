import React from 'react'
import { isAllowAdminsOnly } from '../utils/checkRole'
import { isBudgetAdmin } from '../utils/checkRole'
import { useUser } from '../context/UserContext'
import { Navigate } from 'react-router-dom'

const OnlyAdmins = ({ children }) => {
    const { currentUser } = useUser()
    if (!isAllowAdminsOnly(currentUser)) return <Navigate to='/dashboard' />
    return children
}
const OnlyBudgetAdmins = ({ children }) => {
    const { currentUser } = useUser()
    if (!isBudgetAdmin(currentUser)) return <Navigate to='/AllProposals' />
    return children
}

export default OnlyAdmins