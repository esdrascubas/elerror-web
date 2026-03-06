// Video Modal Handler - Maneja la apertura de modals de video de YouTube
(function () {
  'use strict';

  // Función para abrir el modal con el video de YouTube
  function openVideoModal(videoId) {
    var iframe = document.getElementById('videoIframe');
    var modalElement = document.getElementById('videoModal');
    
    if (!iframe || !modalElement) {
      console.error('Modal elements not found');
      return;
    }

    // Establecer la URL del video con autoplay
    iframe.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1';
    
    // Crear y mostrar el modal
    var modal = new bootstrap.Modal(modalElement);
    modal.show();
  }

  // Inicializar cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Video Modal Handler initialized');

    // Agregar event listeners a todos los enlaces de thumbnails
    var thumbnailLinks = document.querySelectorAll('.video-thumbnail-link');
    
    thumbnailLinks.forEach(function(link) {
      // Capturar eventos antes que nav.js
      link.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }, true); // capture phase = true es la clave!
      
      link.addEventListener('pointerup', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }, true);
      
      link.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        var videoId = this.getAttribute('data-video-id');
        if (videoId) {
          console.log('Opening video modal for:', videoId);
          openVideoModal(videoId);
        }
      }, true); // capture phase
    });

    // Limpiar el iframe cuando se cierra el modal
    var modalElement = document.getElementById('videoModal');
    if (modalElement) {
      modalElement.addEventListener('hidden.bs.modal', function () {
        var iframe = document.getElementById('videoIframe');
        if (iframe) {
          iframe.src = '';
        }
      });
    }
  });

  // Exponer la función globalmente por si se necesita llamar desde la consola
  window.openVideoModal = openVideoModal;
})();
