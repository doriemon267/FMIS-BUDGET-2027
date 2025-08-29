export const isSuperAdmin = (currentUser) => {
    if (currentUser?.Roles && currentUser.Roles.length >= 1) return currentUser.Roles.includes('SUPER ADMIN')
    return false;
}

export const isBudgetAdmin = (currentUser) => {
    if (currentUser?.Roles && currentUser.Roles.length >= 1) return currentUser.Roles.includes('BUDGET ADMIN')
    return false;
}

export const isAccountantAdmin = (currentUser) => {
    if (currentUser?.Roles && currentUser.Roles.length >= 1) return currentUser.Roles.includes('ACCOUNTANT ADMIN')
    return false;
}

export const isDVAdmin = (currentUser) => {
    if (currentUser?.Roles && currentUser.Roles.length >= 1) return currentUser.Roles.includes('DV ADMIN')
    return false;
}

export const isCashAdmin = (currentUser) => {
    if (currentUser?.Roles && currentUser.Roles.length >= 1) return currentUser.Roles.includes('CASH ADMIN')
    return false;
}

export const isAllowAdminsOnly = (currentUser) => {
    return isSuperAdmin(currentUser) || isBudgetAdmin(currentUser) || isAccountantAdmin(currentUser) || isDVAdmin(currentUser) || isCashAdmin(currentUser)
}