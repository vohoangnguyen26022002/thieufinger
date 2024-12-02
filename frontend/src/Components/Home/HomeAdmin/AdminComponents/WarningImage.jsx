import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFailedAttemptImages } from '../../../../redux/apiRequest';
import styles from './css/Image.module.css'

const WarningImage = () => {
  const user = useSelector((state) => state.auth.login?.currentUser);
  const imageList = useSelector((state) => state.users.failedAttemptImages?.images);
  const dispatch = useDispatch();
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 24;

  useEffect(() => {
    if (user?.token) {
      fetchFailedAttemptImages(dispatch, user?.token);
    }
  }, [ dispatch,user]);


    // Hàm chuyển đổi imageId thành timestamp
  const parseImageIdToTimestamp = (imageId) => {
    const [time, date] = imageId.split('_'); // Tách thành phần thời gian và ngày
    const [hour, minute] = time.split(':').map(Number);
    const [day, month, year] = date.split('-').map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime();
  };

   // Kiểm tra nếu imageList không phải là mảng hợp lệ
   if (!Array.isArray(imageList) || imageList.length === 0) {
    return <div className={styles.container}>No failed attempt images found.</div>;
  }

  const sortedImageList = [...imageList].sort(
    (a, b) => parseImageIdToTimestamp(b.id) - parseImageIdToTimestamp(a.id)
  );

  const startIndex = (currentPage - 1) * imagesPerPage;
  const endIndex = startIndex + imagesPerPage;
  const currentImages = sortedImageList.slice(startIndex, endIndex);

  const totalPages = Math.ceil(sortedImageList.length / imagesPerPage);

  // Hàm xử lý khi nhấp vào ảnh để phóng lớn
  const handleImageClick = (imageData) => {
    setSelectedImage(imageData); // Lưu ảnh được chọn
  };

  // Hàm đóng ảnh phóng lớn
  const closeModal = () => {
    setSelectedImage(null); // Đóng modal
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Failed Attempt Images</h3>
      <div className={styles.imageGrid}>
        {currentImages.map((image, index) => {
          const imageData = image.failedAttemptsImage;
          const imageId = image.id;

          return (
            <div key={index} className={styles.imageItem}>
              <h4 className={styles.imageId}>{imageId}</h4>
              {imageData ? (
                <img
                  src={`data:image/jpeg;base64,${imageData}`}
                  alt={`Failed attempt ${index}`}
                  className={styles.image}
                  onClick={() => handleImageClick(imageData)} // Gọi handleImageClick khi nhấp vào ảnh
                />
              ) : (
                <p className={styles.noImage}>No image available</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Hiển thị modal nếu có ảnh được chọn */}
      {selectedImage && (
        <div className={styles.modal}>
          <div className={styles.modalContent} >
            <img
              src={`data:image/jpeg;base64,${selectedImage}`}
              alt=""
              className={styles.modalImage}
              
            />
            <button className={styles.closeButton} onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <div className={styles.pagination}>
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>

        <button className={styles.activePage}>{currentPage}</button>

        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default WarningImage;
