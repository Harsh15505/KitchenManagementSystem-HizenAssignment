import { describe, expect, it } from 'vitest';
import { domainProblem, domainRemovalProblem, emailDomain, emailOnCompanyDomain } from './company';

const PUBLIC = new Set(['gmail.com', 'outlook.com']);

describe('BR-CMP-01: company email domains', () => {
  it('refuses public mail providers, whatever the case', () => {
    expect(domainProblem('Gmail.com', null, PUBLIC, null)).toBe('PUBLIC_EMAIL_DOMAIN');
  });

  it('refuses a domain held by another company', () => {
    expect(domainProblem('lumenlabs.example', 'b', PUBLIC, 'a')).toBe('DOMAIN_TAKEN');
  });

  it('accepts a free domain, or one the company already holds', () => {
    expect(domainProblem('lumenlabs.example', 'a', PUBLIC, null)).toBeNull();
    expect(domainProblem('lumenlabs.example', 'a', PUBLIC, 'a')).toBeNull();
  });

  it('keeps the last domain, and domains active employees use', () => {
    expect(domainRemovalProblem('a.example', ['a.example'], [])).toBe('LAST_DOMAIN');
    expect(domainRemovalProblem('b.example', ['a.example', 'b.example'], ['x@B.example'])).toBe(
      'IN_USE',
    );
    expect(
      domainRemovalProblem('b.example', ['a.example', 'b.example'], ['x@a.example']),
    ).toBeNull();
  });
});

describe('BR-EMP-01: employee email on a company domain', () => {
  it('extracts the domain lower-cased', () => {
    expect(emailDomain('Priya.Sharma@LumenLabs.example')).toBe('lumenlabs.example');
    expect(emailDomain('no-at-sign')).toBe('');
  });

  it('matches only the company domains, never sub-domains or look-alikes', () => {
    const domains = ['lumenlabs.example', 'lumen.example'];
    expect(emailOnCompanyDomain('a@LUMENLABS.example', domains)).toBe(true);
    expect(emailOnCompanyDomain('a@mail.lumenlabs.example', domains)).toBe(false);
    expect(emailOnCompanyDomain('a@lumenlabs.example.evil', domains)).toBe(false);
    expect(emailOnCompanyDomain('lumenlabs.example', domains)).toBe(false);
  });
});
