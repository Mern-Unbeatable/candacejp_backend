export function getInactiveAccountErrorCode(role) {
  return role === 'MEMBER' ? 'MemberAccountInactive' : 'AccountInactive';
}

export function getInactiveAccountMessage(role) {
  if (role === 'MEMBER') {
    return "You don't have an active subscription yet. Please subscribe or contact an administrator.";
  }

  return 'Your account is inactive. Please contact an administrator.';
}
