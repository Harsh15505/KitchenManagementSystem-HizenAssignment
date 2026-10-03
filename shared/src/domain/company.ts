/**
 * Company membership rules (BR-CMP-01, BR-EMP-01/02). Pure: callers pass the lists they loaded.
 */

/** "Priya.Sharma@LumenLabs.example" → "lumenlabs.example" */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1
    ? ''
    : email
        .slice(at + 1)
        .trim()
        .toLowerCase();
}

/** BR-EMP-01: an employee's email must be on one of their company's domains. */
export function emailOnCompanyDomain(email: string, companyDomains: readonly string[]): boolean {
  const domain = emailDomain(email);
  return domain !== '' && companyDomains.some((d) => d.toLowerCase() === domain);
}

export type DomainProblem = 'PUBLIC_EMAIL_DOMAIN' | 'DOMAIN_TAKEN';

/**
 * BR-CMP-01: a domain can't be a public mail provider and can belong to one company only.
 * `owner` is the company currently holding the domain, if any.
 */
export function domainProblem(
  domain: string,
  companyId: string | null,
  publicDomains: ReadonlySet<string>,
  owner: string | null,
): DomainProblem | null {
  const d = domain.trim().toLowerCase();
  if (publicDomains.has(d)) return 'PUBLIC_EMAIL_DOMAIN';
  if (owner !== null && owner !== companyId) return 'DOMAIN_TAKEN';
  return null;
}

/**
 * BR-EMP-01 + BR-CMP-01 on removal: a domain can't be removed while it is the last one, or while
 * active employees still use it.
 */
export function domainRemovalProblem(
  domain: string,
  companyDomains: readonly string[],
  employeeEmails: readonly string[],
): 'LAST_DOMAIN' | 'IN_USE' | null {
  if (companyDomains.length <= 1) return 'LAST_DOMAIN';
  const d = domain.toLowerCase();
  return employeeEmails.some((email) => emailDomain(email) === d) ? 'IN_USE' : null;
}

/**
 * FR-CMP-05 / A-37: orders a new company or kitchen holiday would affect. Delivered, cancelled and
 * rejected orders are settled, so they are not listed. The warning never changes an order.
 */
export const OPEN_ORDER_STATUSES = ['DRAFT', 'PLACED', 'CONFIRMED'] as const;

export function isOpenOrder(status: string): boolean {
  return (OPEN_ORDER_STATUSES as readonly string[]).includes(status);
}
