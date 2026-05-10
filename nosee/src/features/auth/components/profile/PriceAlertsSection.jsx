import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import * as alertsApi from '@/services/api/alerts.api';
import { inputStyle, btnStyle } from './profileStyles';

// ─── Sección de alertas de precio ────────────────────────────────────────────
function PriceAlertsSection() {
  const { t } = useLanguage();
  const tpa = t.profile.priceAlerts;
  const [alerts, setAlerts] = useState([]);
  const [matchingAlerts, setMatchingAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [showProductOptions, setShowProductOptions] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const productComboRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const result = await alertsApi.getUserAlerts();
    if (result.success) setAlerts(result.data);
    const matchesResult = await alertsApi.checkMatchingAlerts();
    if (matchesResult.success) {
      setMatchingAlerts(matchesResult.data || []);
    }
    const notificationsResult = await alertsApi.getUserAlertNotifications(8);
    if (notificationsResult.success) {
      setNotifications(notificationsResult.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  useEffect(() => {
    const query = productQuery.trim();
    if (query.length < 2) {
      setProductOptions([]);
      setSearchingProducts(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearchingProducts(true);
      const result = await alertsApi.searchAlertProducts(query, 8);
      if (result.success) {
        setProductOptions(result.data || []);
      } else {
        setProductOptions([]);
      }
      setSearchingProducts(false);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [productQuery]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!productComboRef.current) return;
      if (!productComboRef.current.contains(event.target)) {
        setShowProductOptions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedProduct?.productId) {
      setError(tpa.selectProductError);
      return;
    }
    if (!targetPrice) return;
    setSaving(true);
    setError(null);
    const result = await alertsApi.createAlert({
      productId: Number(selectedProduct.productId),
      targetPrice: Number(targetPrice),
    });
    if (result.success) {
      setProductQuery('');
      setSelectedProduct(null);
      setProductOptions([]);
      setTargetPrice('');
      fetchAlerts();
    } else {
      setError(result.error);
    }
    setSaving(false);
  };

  const handleDelete = async (alertId) => {
    await alertsApi.deleteAlert(alertId);
    fetchAlerts();
  };

  return (
    <div style={{
      marginTop: '20px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      padding: '20px 24px',
    }}>
      <h2
        id="price-alerts-title"
        style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}
      >
        <span aria-hidden="true">🔔 </span>{tpa.title}
      </h2>
      <p id="price-alerts-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        {tpa.description}
      </p>

      {/* Formulario nueva alerta */}
      <form
        id="price-alerts-form"
        onSubmit={handleCreate}
        aria-labelledby="price-alerts-title"
        aria-describedby="price-alerts-desc"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '8px',
          marginBottom: '16px',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <label htmlFor="alert-product-combobox" style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {tpa.productLabel} <span aria-hidden="true" style={{ color: 'var(--error)' }}>*</span>
            <span className="sr-only">{tpa.required}</span>
          </label>
          <div ref={productComboRef} style={{ position: 'relative' }}>
            <input
              id="alert-product-combobox"
              type="text"
              placeholder={tpa.productPlaceholder}
              value={productQuery}
              onChange={(e) => {
                const next = e.target.value;
                setProductQuery(next);
                setSelectedProduct(null);
                setShowProductOptions(true);
              }}
              onFocus={() => setShowProductOptions(true)}
              required
              aria-required="true"
              aria-autocomplete="list"
              aria-expanded={showProductOptions}
              aria-controls="alert-product-options"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'alert-form-error' : undefined}
              style={inputStyle}
            />

            {showProductOptions && (
              <div
                id="alert-product-options"
                role="listbox"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 'calc(100% + 6px)',
                  zIndex: 50,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  boxShadow: '0 8px 22px rgba(0,0,0,0.16)',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                {searchingProducts ? (
                  <p style={{ margin: 0, padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {tpa.searchingProducts}
                  </p>
                ) : productQuery.trim().length < 2 ? (
                  <p style={{ margin: 0, padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {tpa.searchHint}
                  </p>
                ) : productOptions.length === 0 ? (
                  <p style={{ margin: 0, padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {tpa.noProductResults}
                  </p>
                ) : (
                  productOptions.map((option) => {
                    const displayName = option.brandName
                      ? `${option.productName} · ${option.brandName}`
                      : option.productName;
                    const currentPrice = Number(option.price || 0).toLocaleString();
                    return (
                      <button
                        key={option.publicationId}
                        type="button"
                        role="option"
                        aria-selected={selectedProduct?.publicationId === option.publicationId}
                        onClick={() => {
                          setSelectedProduct(option);
                          setProductQuery(displayName);
                          setShowProductOptions(false);
                          setError(null);
                        }}
                        style={{
                          width: '100%',
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          background: selectedProduct?.publicationId === option.publicationId ? 'var(--bg-base)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: '10px',
                          padding: '10px 12px',
                          textAlign: 'left',
                        }}
                      >
                        <img
                          src={option.photoUrl || 'https://via.placeholder.com/56x56?text=Foto'}
                          alt={displayName}
                          style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                          onError={(event) => {
                            event.currentTarget.src = 'https://via.placeholder.com/56x56?text=Foto';
                          }}
                        />
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {displayName}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            ${currentPrice} · {option.storeName || tpa.unknownStore}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <label htmlFor="alert-target-price" style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {tpa.targetPriceLabel} <span aria-hidden="true" style={{ color: 'var(--error)' }}>*</span>
            <span className="sr-only">{tpa.required}</span>
          </label>
          <input
            id="alert-target-price"
            type="number"
            placeholder={tpa.targetPricePlaceholder}
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            min="0"
            step="0.01"
            required
            aria-required="true"
            style={inputStyle}
          />
        </div>
      </form>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {!loading && alerts.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            {tpa.empty}
          </p>
        ) : (
          <span />
        )}

        <button
          type="submit"
          form="price-alerts-form"
          disabled={saving}
          aria-busy={saving}
          style={{ ...btnStyle, alignSelf: 'end' }}
        >
          {saving ? tpa.saving : tpa.addAlert}
        </button>
      </div>

      {error && (
        <p
          id="alert-form-error"
          role="alert"
          style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '12px' }}
        >
          <span aria-hidden="true">⚠ </span>{error}
        </p>
      )}

      {matchingAlerts.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: '12px',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(16,185,129,0.35)',
            background: 'rgba(16,185,129,0.12)',
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {tpa.matchesTitle}
          </p>
          <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)' }}>
            {matchingAlerts.slice(0, 3).map((match) => {
              const name = match?.publication?.products?.name || tpa.unknownProduct(match?.alert?.product_id);
              const currentPrice = Number(match?.publication?.price || 0).toLocaleString();
              const target = Number(match?.alert?.target_price || 0).toLocaleString();
              return (
                <li key={match?.alert?.id} style={{ fontSize: '12px' }}>
                  {tpa.matchItem(name, currentPrice, target)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!loading && (
        <div
          style={{
            marginBottom: '12px',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-base)',
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {tpa.notificationsTitle}
          </p>
          {notifications.length === 0 ? (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
              {tpa.notificationsEmpty}
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)' }}>
              {notifications.slice(0, 5).map((notification) => {
                const pub = notification.publication;
                const productName = pub?.product?.name || tpa.unknownProduct(notification?.alert?.id || '?');
                const brandName = pub?.product?.brand?.name ? ` · ${pub.product.brand.name}` : '';
                const currentPrice = Number(pub?.price || 0).toLocaleString();
                const target = Number(notification?.alert?.target_price || 0).toLocaleString();
                const store = pub?.store?.name || tpa.unknownStore;
                return (
                  <li key={notification.id} style={{ fontSize: '12px', marginBottom: '4px' }}>
                    {tpa.notificationItem(productName, brandName, currentPrice, target, store)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Lista de alertas */}
      {loading ? (
        <p role="status" aria-live="polite" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {tpa.loading}
        </p>
      ) : alerts.length === 0 ? (
        <span />
      ) : (
        <ul
          aria-label={tpa.listLabel}
          style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}
        >
          {alerts.map((a) => {
            const productName = a.products?.name ?? tpa.unknownProduct(a.product_id);
            const priceFormatted = Number(a.target_price).toLocaleString();
            return (
              <li key={a.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-base)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '10px 14px',
              }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{productName}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    ≤ ${priceFormatted}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  aria-label={tpa.deleteAriaLabel(productName, priceFormatted)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '13px', minHeight: '44px', minWidth: '44px' }}
                >
                  {tpa.delete}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default PriceAlertsSection;
