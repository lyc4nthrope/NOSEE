import { useCallback } from 'react';

/**
 * Hook que genera handlers de confirmación para ocultar publicaciones, tiendas, marcas y productos.
 * Cada handler abre un modal de confirmación con la acción correspondiente.
 *
 * @param {Object} params
 * @param {Array} params.publications - Lista de publicaciones
 * @param {Object} params.td - Textos de traducción del dashboard admin
 * @param {Function} params.executeDeletePublication - Callback para borrar publicación
 * @param {Function} params.handleExecuteDeleteStore - Callback para borrar tienda
 * @param {Function} params.handleExecuteDeleteBrand - Callback para borrar marca
 * @param {Function} params.handleExecuteDeleteProduct - Callback para borrar producto
 * @param {Function} params.setConfirmModal - Setter del modal de confirmación
 * @returns {{
 *   handleDeletePublication: Function,
 *   handleDeleteStore: Function,
 *   handleDeleteBrand: Function,
 *   handleDeleteProduct: Function,
 * }}
 */
export default function useAdminConfirmHandlers({
  publications, td,
  executeDeletePublication,
  handleExecuteDeleteStore,
  handleExecuteDeleteBrand,
  handleExecuteDeleteProduct,
  setConfirmModal,
}) {
  const handleDeletePublication = useCallback((publicationInput) => {
    const publication =
      typeof publicationInput === 'object'
        ? publicationInput
        : publications.find((p) => p.id === publicationInput);
    const pubId = publication?.id || publicationInput;
    const isActive = publication?.is_active === true;
    if (!pubId) return;
    if (isActive) {
      setConfirmModal({
        isOpen: true,
        title: td.promptHideTitle || 'Moderar publicación',
        message: td.promptHidePub,
        actions: [
          { label: td.promptHideOption1 || 'Solo ocultar', onClick: () => executeDeletePublication(pubId, 'hide') },
          { label: td.promptHideOption2 || 'Ocultar completamente', onClick: () => executeDeletePublication(pubId, 'hide_full'), danger: true },
        ],
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: td.confirmHideTitle || 'Ocultar completamente',
        message: td.confirmHideFull,
        onConfirm: () => executeDeletePublication(pubId, 'hide_full'),
      });
    }
  }, [publications, td, executeDeletePublication]);

  const handleDeleteStore = useCallback((publication) => {
    const storeId = publication?.storeId || publication?.store?.id || publication?.store_id || publication?.id;
    const storeName = publication?.storeName || publication?.store?.name || publication?.name || 'esta tienda';
    if (!storeId) return;
    setConfirmModal({
      isOpen: true,
      title: td.confirmHideTitle || 'Ocultar tienda',
      message: td.confirmHide(storeName),
      onConfirm: () => handleExecuteDeleteStore(storeId, storeName),
    });
  }, [td, handleExecuteDeleteStore]);

  const handleDeleteBrand = useCallback((publication) => {
    const brandId = publication?.brandId || publication?.product?.brand?.id || publication?.id;
    const brandName = publication?.brandName || publication?.product?.brand?.name || publication?.name || 'esta marca';
    if (!brandId) {
      console.error(td.errorNoBrand);
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: td.confirmHideTitle || 'Ocultar marca',
      message: td.confirmHideBrand(brandName),
      onConfirm: () => handleExecuteDeleteBrand(brandId, brandName),
    });
  }, [td, handleExecuteDeleteBrand]);

  const handleDeleteProduct = useCallback((product) => {
    const productId = product?.productId || product?.id;
    const productName = product?.productName || product?.name || 'este producto';
    if (!productId) return;
    setConfirmModal({
      isOpen: true,
      title: td.confirmHideTitle || 'Ocultar producto',
      message: td.confirmHide(productName),
      onConfirm: () => handleExecuteDeleteProduct(productId, productName),
    });
  }, [td, handleExecuteDeleteProduct]);

  return { handleDeletePublication, handleDeleteStore, handleDeleteBrand, handleDeleteProduct };
}
