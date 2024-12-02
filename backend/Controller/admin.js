const admin = require("firebase-admin");
const db = admin.firestore();
const { format } = require('date-fns-tz');
const firebaseDb = admin.database();


const adminController = {
    // GET ALL USERS (Admin Only)
    getAllUsers: async (req, res) => {
      try {
        const userId = req.user.uid; 
  
        const userDoc = await db.collection("users").doc(userId).get();
        
        if (!userDoc.exists) {
          return res.status(404).json({ error: "User not found" });
        }
        
        const userData = userDoc.data();
        if (!userData.admin) {
          return res.status(403).json({ error: "Access denied" });
        }
  
        // Fetch all users if admin
        const usersSnapshot = await db.collection("users").get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        res.status(200).json(users);
      } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    },

// Hàm lấy danh sách lịch sử mở khóa
    getUnlockHistory: async (req, res) => {
      try {
    const userId = req.user.uid;

    // Lấy thông tin người dùng từ Firestore
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userDoc.data();
    if (!userData.admin) {
      return res.status(403).json({ error: "Access denied: Admins only" });
    }

    // Thiết lập múi giờ Việt Nam
    const timeZone = 'Asia/Ho_Chi_Minh';

    // Lấy dữ liệu lịch sử mở khóa
    const historySnapshot = await db.collection('History').get();

    // Duyệt qua từng bản ghi để lấy thông tin username
    const historyList = await Promise.all(historySnapshot.docs.map(async (doc) => {
      const data = doc.data();
      const vnTimestamp = format(new Date(data.timestamp), 'yyyy-MM-dd HH:mm:ss', { timeZone });

      // Truy vấn username dựa trên uid
      const userRef = await db.collection("users").doc(data.uid).get();
      const username = userRef.exists ? userRef.data().username : "Unknown User";

      return {
        id: doc.id,
        uid: data.uid,
        username: data.username,      // Thêm username để dễ quản lý
        timestamp: vnTimestamp,  // Thời gian theo múi giờ Việt Nam
        action: data.action,
      };
    }));

    res.status(200).json(historyList);
  } catch (error) {
    console.error("Error fetching unlock history:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }},

/// Hàm update admin và can_open ở backe
updateUsers: async (req, res) => {
  try {
      const userId = req.user.uid; 
      console.log(userId);
      // Lấy thông tin người dùng từ Firestore
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
          return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      if (!userData.admin) {
          return res.status(403).json({ error: "Access denied: Admins only" });
      }

      const { userId: targetUserId, admin, can_open, idfinger } = req.body;

      console.log("Target User ID:", targetUserId);

      if (!targetUserId) {
          return res.status(400).json({ error: "User ID is required." });
      }

      const targetUserRef = db.collection("users").doc(targetUserId);
      const targetUserDoc = await targetUserRef.get();
      if (!targetUserDoc.exists) {
          return res.status(404).json({ error: "Target user not found" });
      }

      // Cập nhật quyền cho người dùng
      await targetUserRef.update({ admin, can_open, idfinger });

      console.log("User privileges updated for user:", targetUserId);

      res.status(200).json({ message: "User privileges updated successfully." });
  } catch (error) {
      console.error("Error updating user privileges:", error); // Log the error
      res.status(500).json({ error: "Internal Server Error" });
  }
},

//Hàm xóa user
deleteUser: async (req, res) => {
  try {
    const userId = req.user.uid;
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    if (!userData.admin) {
      return res.status(403).json({ error: "Access denied: Admins only" });
    }
    console.log(req.body);
    const { userId: targetUserId } = req.body;  

    if (!targetUserId) {
      return res.status(400).json({ error: "Target user ID is required." });
    }

    const targetUserRef = db.collection("users").doc(targetUserId);
    const targetUserDoc = await targetUserRef.get();
    
    if (!targetUserDoc.exists) {
      return res.status(404).json({ error: "Target user not found" });
    }
    await targetUserRef.delete();
    
     // Xóa người dùng khỏi Firebase Authentication
     await admin.auth().deleteUser(targetUserId);  // Xóa người dùng khỏi Firebase Auth
     console.log('User deleted from Firebase Authentication');
 
    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
},

getFailedAttemptsImages: async (req, res) => {
  try {
    const userId = req.user.uid;

    // Kiểm tra quyền admin của người dùng
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userDoc.data();
    if (!userData.admin) {
      return res.status(403).json({ error: "Access denied: Admins only" });
    }

      // Truy vấn dữ liệu từ Firebase Realtime Database (nhánh failedAttempts)
      const failedAttemptsSnapshot = await admin.database().ref('failedAttempts').once('value');

      // Kiểm tra nếu không có dữ liệu
      if (!failedAttemptsSnapshot.exists()) {
        return res.status(404).json({ error: "No failed attempts found" });
      }

      const failedAttemptsImages = [];
      failedAttemptsSnapshot.forEach(childSnapshot => {
        const data = childSnapshot.val();
        
        // Kiểm tra nếu có dữ liệu hình ảnh
        if (data) {
          failedAttemptsImages.push({
            id: childSnapshot.key,  // Lấy ID bản ghi
            failedAttemptsImage: data // Hình ảnh dưới dạng base64
          });
        }
      });

      // Trả về danh sách hình ảnh failedAttempts
      res.status(200).json(failedAttemptsImages);
    } catch (error) {
      console.error("Error fetching failed attempts images:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

   // Hàm lấy danh sách lịch sử đóng cửa
   getCloseHistory: async (req, res) => {
    try {
      const userId = req.user.uid;

      // Lấy thông tin người dùng từ Firestore
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }
      const userData = userDoc.data();
      if (!userData.admin) {
        return res.status(403).json({ error: "Access denied: Admins only" });
      }

      // Thiết lập múi giờ Việt Nam
        const timeZone = 'Asia/Ho_Chi_Minh';

      // Lấy dữ liệu lịch sử đóng cửa
        const historySnapshot = await db.collection('History')
        .where('closetime', '!=', null)  // Lọc chỉ các bản ghi có 'closetime'
        .get();

      // Duyệt qua từng bản ghi để lấy thông tin username
        const historyList = await Promise.all(historySnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const vnTimestamp = format(new Date(data.closetime), 'yyyy-MM-dd HH:mm:ss', { timeZone });

        // Truy vấn username dựa trên uid
        const userRef = await db.collection("users").doc(data.uid).get();
        const username = userRef.exists ? userRef.data().username : "Unknown User";

        return {
          id: doc.id,
          uid: data.uid,
          username: data.username,  // Lấy username người dùng
          closetime: vnTimestamp,  // Thời gian đóng cửa theo múi giờ Việt Nam
        };
      }));

      res.status(200).json(historyList);
    } catch (error) {
      console.error("Error fetching close history:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  getAllHistory: async (req, res) => {
    try {
      // Truy vấn tất cả các bản ghi từ Firestore, sắp xếp theo thời gian mở khóa
      const historySnapshot = await db.collection('History').orderBy('timestamp', 'desc').get();
  
      if (historySnapshot.empty) {
        return res.status(404).json({ message: "No unlock history found" });
      }
  
      // Xử lý kết quả và trả về danh sách lịch sử
      const historyList = historySnapshot.docs.map(doc => ({
        id: doc.id,          // ID của bản ghi
        ...doc.data()        // Dữ liệu trong bản ghi
      }));
  
      res.status(200).json(historyList);
    } catch (error) {
      console.error("Error fetching unlock history:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }, 
  
// Lắng nghe thay đổi của "id mo khoa"
listenIdMoKhoaChanges: async (req, res) => {
  try {
    const idMoKhoaRef = admin.database().ref('id mo khoa');

    idMoKhoaRef.on('value', async (snapshot) => {
      const idMoKhoa = snapshot.val();
      console.log(`ID mở khóa: ${idMoKhoa}`);
      
      if (!idMoKhoa) return;

      // Truy vấn người dùng từ Firestore
      const usersCollection = db.collection("users");
      const userQuery = usersCollection.where("idfinger", "==", idMoKhoa);
      const querySnapshot = await userQuery.get();

      if (querySnapshot.empty) {
        console.log("Không tìm thấy người dùng với ID vân tay này.");
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const userName = userData.userName || "Unknown User";
      const userEmail = userData.email || "No Email";

      console.log(`Ngườikhóa: ${userData}`);
      console.log(`Người mở khóa: ${userName}`);

      // Tạo bản ghi mở khóa
      const FingerHistory = {
        userName: userName,
        email: userEmail,
        openTime: null,
        closeTime: null,
        timestamp: new Date().toISOString(), 
        status: "Chưa mở",
      };

      // Lưu bản ghi vào Firestore
      const historyCollection = db.collection("FingerHistory");
      const historyDocRef = await historyCollection.add(FingerHistory);
      console.log("Bản ghi mở khóa đã được tạo:", FingerHistory);

      const cuaRef = firebaseDb.ref('cua');
      let previousDoorStatus = null; // Không xác định trạng thái cửa ban đầu

      cuaRef.on('value', async (snap) => {
        const doorStatus = snap.val();

        // Chỉ theo dõi khi có ID mở cửa
        if (previousDoorStatus === null) {
          // Trạng thái cửa vẫn chưa được xác định (chưa có thay đổi)
          previousDoorStatus = doorStatus;
          return;
        }

        // Kiểm tra nếu cửa chuyển trạng thái từ đóng (true) sang mở (false)
        if (doorStatus === false && previousDoorStatus === true) {
          // Tìm bản ghi mới nhất để cập nhật openTime
          const latestHistorySnapshot = await historyCollection
            // .where('status', '==', 'Chưa mở')  // Lọc những bản ghi chưa mở
            // .where('userName', '==', userName)  // Lọc theo userName để chỉ lấy bản ghi của người này
            .where('openTime', '==', null)
            .orderBy('timestamp', 'desc')  // Sắp xếp theo thời gian, bản ghi mới nhất sẽ lên đầu
            .limit(1)  // Chỉ lấy 1 bản ghi mới nhất
            .get();

          if (!latestHistorySnapshot.empty) {
            const latestDoc = latestHistorySnapshot.docs[0];
            const latestDocRef = latestDoc.ref;

            // Cập nhật thời gian mở cửa
            const openTime = new Date().toISOString();
            await latestDocRef.update({
              openTime,
              status: "Đã mở", // Cập nhật trạng thái cửa
            });
            console.log("Cập nhật thời gian mở cửa:", openTime);
          }
        }

        // Kiểm tra nếu cửa chuyển trạng thái từ mở (false) sang đóng (true)
        if (doorStatus === true && previousDoorStatus === false) {
          // Tìm bản ghi mới nhất để cập nhật closeTime
          const latestHistorySnapshot = await historyCollection
            // .where('status', '==', 'Đã mở')  // Lọc những bản ghi đã mở
            // .where('userName', '==', userName)  // Lọc theo userName để chỉ lấy bản ghi của người này
            .where('closeTime', '==', null)
            .orderBy('timestamp', 'desc')  // Sắp xếp theo thời gian, bản ghi mới nhất sẽ lên đầu
            .limit(1)  // Chỉ lấy 1 bản ghi mới nhất
            .get();

          if (!latestHistorySnapshot.empty) {
            const latestDoc = latestHistorySnapshot.docs[0];
            const latestDocRef = latestDoc.ref;

            // Cập nhật thời gian đóng cửa
            const closeTime = new Date().toISOString();
            await latestDocRef.update({
              closeTime,
              status: "Đã đóng", // Cập nhật trạng thái cửa
            });
            console.log("Cập nhật thời gian đóng cửa:", closeTime);
          }
        }

        // Cập nhật trạng thái của cửa (để so sánh lần sau)
        previousDoorStatus = doorStatus;
      });
    });
  } catch (error) {
    console.error("Lỗi khi xử lý lắng nghe ID mở khóa: ", error);
    res.status(500).send("Lỗi server.");
  }
},
  getFingerHistory: async (req, res) => {
  try {
    // Kết nối tới collection "FingerHistory"
    const historyCollection = db.collection("FingerHistory");

    // Lấy toàn bộ dữ liệu và sắp xếp theo thời gian mở cửa mới nhất
    const querySnapshot = await historyCollection
      .orderBy("openTime", "desc")
      .get();

    // Chuyển dữ liệu Firestore thành mảng các đối tượng JSON
    const fingerHistory = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Trả dữ liệu về client
    res.status(200).json(fingerHistory);
  } catch (error) {
    console.error("Error fetching finger history:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
},
}

  module.exports = adminController;