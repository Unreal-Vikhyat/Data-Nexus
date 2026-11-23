const roleRank = Object.freeze({ viewer: 0, editor: 1, admin: 2, owner: 3 });

export function roleMeetsMinimum(actualRole, minimumRole) {
  return Number.isInteger(roleRank[actualRole])
    && Number.isInteger(roleRank[minimumRole])
    && roleRank[actualRole] >= roleRank[minimumRole];
}
