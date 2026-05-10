/**
 * RegisterForm - Formulario de registro de nuevo usuario
 */
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useLanguage } from '@/contexts/LanguageContext';

// Íconos
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="M2 7l10 7 10-7"/>
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const EyeIcon = ({ open }) => open ? (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// Tests de las reglas (sin labels hardcodeados)
const PASSWORD_RULE_TESTS = [
  (v) => v.length >= 8,
  (v) => /[A-Z]/.test(v),
  (v) => /\d/.test(v),
];

export default function RegisterForm({ onSubmit, onGoogleRegister, loading = false, error = null }) {
  const { t } = useLanguage();
  const tf = t.registerForm;

  const passwordRules = PASSWORD_RULE_TESTS.map((test, i) => ({
    label: tf.passwordRules[i],
    test,
  }));

  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const checkboxRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }));
  };

  const toggleShowPassword = () => setShowPassword(prev => !prev);

  const validate = () => {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = tf.fullNameRequired;
    if (!form.email) errors.email = tf.emailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = tf.emailInvalid;
    if (!form.password) errors.password = tf.passwordRequired;
    else if (!passwordRules.every(r => r.test(form.password))) errors.password = tf.passwordWeak;
    if (!form.confirmPassword) errors.confirmPassword = tf.confirmRequired;
    else if (form.password !== form.confirmPassword) errors.confirmPassword = tf.passwordMismatch;
    return errors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!termsAccepted) {
      setTermsError(true);
      checkboxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      checkboxRef.current?.focus();
      return;
    }
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    onSubmit(form.email, form.password, { fullName: form.fullName });
  };

  const pwdStrength = passwordRules.filter(r => r.test(form.password)).length;
  const passwordsMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;
  const mismatchStyle = passwordsMismatch ? { background: 'rgba(248, 113, 113, 0.08)', border: '1px solid var(--error)' } : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {error && (
        <div role="alert" style={{
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          background: 'var(--error-soft)', border: '1px solid rgba(248,113,113,0.25)',
          color: 'var(--error)', fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      <Button
        type="button"
        fullWidth
        size="lg"
        variant="secondary"
        onClick={() => {
          if (!termsAccepted) {
            setTermsError(true);
            checkboxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            checkboxRef.current?.focus();
            return;
          }
          localStorage.setItem('nosee_google_intent', 'register');
          onGoogleRegister();
        }}
        disabled={loading || !termsAccepted}
      >
        {tf.googleRegister}
      </Button>
      {termsError && !termsAccepted && (
        <p role="alert" style={{ margin: '-10px 0 0', fontSize: '12px', color: 'var(--error)', textAlign: 'center' }}>
          {tf.termsRequired}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tf.orForm}</span>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      <Input
        label={tf.fullNameLabel}
        id="reg-fullname"
        name="fullName"
        type="text"
        value={form.fullName}
        onChange={handleChange}
        placeholder={tf.fullNamePlaceholder}
        error={fieldErrors.fullName}
        iconLeft={<UserIcon />}
        autoComplete="name"
        required
        disabled={loading}
      />

      <Input
        label={tf.emailLabel}
        id="reg-email"
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        placeholder={tf.emailPlaceholder}
        error={fieldErrors.email}
        iconLeft={<MailIcon />}
        autoComplete="email"
        required
        disabled={loading}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <Input
            label={tf.passwordLabel}
            id="reg-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={handleChange}
            onCopy={!showPassword ? (e) => e.preventDefault() : undefined}
            placeholder={tf.passwordPlaceholder}
            error={fieldErrors.password}
            iconLeft={<LockIcon />}
            iconRight={
              <button
                type="button"
                onClick={toggleShowPassword}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
                aria-label={showPassword ? tf.hidePassword : tf.showPassword}
                disabled={loading}
              >
                <EyeIcon open={showPassword} />
              </button>
            }
            style={mismatchStyle}
            autoComplete="new-password"
            required
            disabled={loading}
          />
        </div>

        {form.password.length > 0 && (
          <div aria-live="polite" aria-atomic="true" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="sr-only">
              {pwdStrength === 3 ? tf.strongPassword : pwdStrength === 2 ? tf.mediumPassword : tf.weakPassword}
            </span>
            <div aria-hidden="true" style={{ display: 'flex', gap: '4px' }}>
              {passwordRules.map((rule, i) => (
                <div key={rule.label} style={{
                  flex: 1, height: '3px', borderRadius: '2px',
                  background: i < pwdStrength ? (pwdStrength === 3 ? 'var(--success)' : 'var(--warning)') : 'var(--border)',
                  transition: 'background 0.2s ease',
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {passwordRules.map((rule) => {
                const met = rule.test(form.password);
                return (
                  <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: met ? 'var(--success)' : 'var(--text-muted)' }}>
                    <span aria-hidden="true" style={{ opacity: met ? 1 : 0.4 }}><CheckIcon /></span>
                    {rule.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Input
        label={tf.confirmPasswordLabel}
        id="reg-confirm"
        name="confirmPassword"
        type={showConfirmPassword ? 'text' : 'password'}
        value={form.confirmPassword}
        onChange={handleChange}
        onCopy={!showConfirmPassword ? (e) => e.preventDefault() : undefined}
        placeholder={tf.confirmPasswordPlaceholder}
        error={fieldErrors.confirmPassword}
        iconLeft={<LockIcon />}
        iconRight={
          <button
            type="button"
            onClick={() => setShowConfirmPassword(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
            aria-label={showConfirmPassword ? tf.hidePassword : tf.showPassword}
            disabled={loading}
          >
            <EyeIcon open={showConfirmPassword} />
          </button>
        }
        style={mismatchStyle}
        autoComplete="new-password"
        required
        disabled={loading}
      />

      {/* Checkbox de aceptación de términos */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => {
            setTermsAccepted(e.target.checked);
            if (e.target.checked) setTermsError(false);
          }}
          disabled={loading}
          style={{ marginTop: '2px', accentColor: 'var(--accent)', width: '15px', height: '15px', flexShrink: 0, cursor: 'pointer' }}
          aria-label={`${tf.terms} ${tf.termsLink} ${tf.and} ${tf.privacyLink}`}
        />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {tf.terms}{' '}
          <Link to="/terminos" target="_blank" rel="noopener noreferrer" state={{ from: '/registro', label: 'Registrarse' }} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: '500' }}>{tf.termsLink}</Link>
          {' '}{tf.and}{' '}
          <Link to="/privacidad" target="_blank" rel="noopener noreferrer" state={{ from: '/registro', label: 'Registrarse' }} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: '500' }}>{tf.privacyLink}</Link>.
        </span>
      </label>

      <Button type="submit" fullWidth loading={loading} disabled={loading || !termsAccepted} size="lg">
        {loading ? tf.creatingAccount : tf.createAccount}
      </Button>

      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
        {tf.hasAccount}{' '}
        <Link to="/login" style={{ color: 'var(--accent)', fontWeight: '500', textDecoration: 'none' }}>
          {tf.loginLink}
        </Link>
      </p>
    </form>
  );
}
