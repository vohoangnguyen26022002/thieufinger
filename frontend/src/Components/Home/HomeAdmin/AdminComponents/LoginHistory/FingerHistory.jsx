import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fingerHistory } from '../../../../../redux/apiRequest';
import styles from '../LoginHistory/FingerHistory.module.css';

const FingerHistory = () => {
  const user = useSelector((state) => state.auth.login?.currentUser);
  
  const FingerList = useSelector((state) => state.users.fingerHistories?.allFinger);
  const dispatch = useDispatch();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  console.log("fingersss",FingerList)

  useEffect(() => {
    if(user?.token) {
      fingerHistory(user?.token, dispatch);
    }
  },[user, dispatch]);
  

  // Hàm phân trang
 const paginate = (data) => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return data.slice(startIndex, startIndex + itemsPerPage);
};



// Sắp xếp danh sách theo unlockTime (mới nhất trước)
const sortedFingerList = Array.isArray(FingerList)
? [...FingerList].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
: [];

  // GỌI hàm phân trang
  const paginatedEntries = paginate(sortedFingerList);

  // Tính tổng số trang
  const totalPages = Math.ceil(sortedFingerList.length / itemsPerPage);
  

  return (
    <div className={styles['finger-history']}>
    <h2>Login Finger History</h2>
    <table className={styles['finger-table']}>
      <thead>
        <tr>
          <th>Người mở</th>
          <th>Thời gian mở cửa</th>
          <th>Thời gian đóng cửa</th>
        </tr>
      </thead>
      <tbody>
      {paginatedEntries.length > 0 ? (
            paginatedEntries.map((entry, index) => (
              <tr key={entry.id || index}> 
                <td>{entry.userName || undefined }</td>
                <td> {entry.openTime 
                    ? new Date(entry.openTime).toLocaleString() 
                    : "Chưa mở"}
                </td>
                <td>
                  {entry.closeTime 
                    ? new Date(entry.closeTime).toLocaleString() 
                    : "Chưa đóng"}
          
                </td>
              </tr>
              
            ))
          ) : (
            <tr>
              <td colSpan="2">No login history available.</td>
            </tr>
          )}
        </tbody>
      </table>
      
      <div className={styles.pagination}>
        <button 
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button 
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default FingerHistory;
