import React from 'react'
import { isSuperAdmin } from '../utils/checkRole'
import { useUser } from '../context/UserContext'
import { Navigate } from 'react-router-dom'

const OnlySuperAdmins = ({ children }) => {
    const { currentUser } = useUser()
    if (!isSuperAdmin(currentUser)) return <Navigate to='/dashboard' />
    return children
}

export default OnlySuperAdmins