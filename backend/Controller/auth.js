// auth.js
const admin = require("firebase-admin");
const serviceAcount = require("../config/serviceAcount.json");
const firebaseclient = require("../config/firebaseclient.json");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { initializeApp } = require("firebase/app");


admin.initializeApp({
  credential: admin.credential.cert(serviceAcount),
  databaseURL: "https://datn2024-nt-default-rtdb.asia-southeast1.firebasedatabase.app/"
});
const firebaseDb = admin.database();
const db = admin.firestore();
const firebaseApp = initializeApp(firebaseclient);

const auth = getAuth(firebaseApp);




// Hàm đăng ký
const signup = async (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
    userName: req.body.username
  };

  try {
    const userResponse = await admin.auth().createUser({
      email: user.email,
      password: user.password,
      emailVerified: false,
      disabled: false
    });

    // Lưu vào Firestore
    await db.collection('users').doc(userResponse.uid).set({
      email: user.email,
      userName: user.userName,
      admin: false,
      can_open: false,
      idfinger: "",
      createdAt: new Date().toISOString()
    });

    res.json(userResponse);
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(400).json({ error: error.message });
  }
};

// Hàm đăng nhập
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Đăng nhập người dùng bằng Firebase client
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userRecord = userCredential.user;

      // Lấy ID Token
    const idToken = await userRecord.getIdToken();
    
    // Lấy thông tin người dùng từ Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
  
    // Gửi phản hồi với thông tin người dùng và quyền
    res.json({
      message: "Login successful",
      uid: userRecord.uid,
      email: userData.email,
      userName: userData.userName,
      admin: userData.admin, 
      can_open: userData.can_open,
      idToken: idToken,
      idfinger: userData.idfinger
    });

  } catch (error) {
    console.error("Error during login:", error);
    res.status(400).json({ error: error.message });
  }
};

// Hàm đăng xuất
const logout = async (req, res) => {
  try {
    const auth = getAuth();
    await signOut(auth);
    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(400).json({ error: error.message });
  }
};

// Hàm thay đổi mật khẩu
const changePassword = async (req, res) => {
  const { newPassword } = req.body;
  const uid = req.user.uid;

  try {
    await admin.auth().updateUser(uid, {
      password: newPassword
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error during password change:", error);
    res.status(400).json({ error: error.message });
  }
};

// Hàm ghi lại lịch sử mở khóa
const logUnlockHistory = async (req, res) => {
  const uid = req.user?.uid; 
  const timestamp = new Date().toISOString(); 

  if (!uid) {
    return res.status(403).json({ error: "User not authenticated" });
  }

  try {
    const ref = firebaseDb.ref('cua');
    const snapshot = await ref.once('value');
    const doorStatus = snapshot.val(); 

    if (doorStatus === false) {
      return res.status(400).json({ error: "The door is already open, no need to log unlock history." });
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const username = userDoc.data().userName || "Unknown User";

    // Tạo một bản ghi lịch sử mở khóa
    const historyRef = await db.collection('History').add({
      uid: uid,
      username: username,         // UID của người mở khóa
      timestamp: timestamp,       // Thời gian mở khóa
      action: 'Unlocked',         // Hoạt động mở khóa
      closetime: null
    });

    res.status(200).json({ 
      message: "Unlock history logged successfully!",
      historyId: historyRef.id // Trả về historyId để sử dụng sau khi cửa đóng
    });
  } catch (error) {
    console.error("Error logging unlock history:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


 // GET KHOA STATUS
const getKhoaStatus = async (req, res) => {
  try {
    const ref = firebaseDb.ref('khoa');
    const snapshot = await ref.once('value');
    const value = snapshot.val();
    
    res.status(200).json({ khoa: value });
  } catch (error) {
    console.error("Error fetching khoa status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// UPDATE KHOA STATUS
const updateKhoaStatus = async (req, res) => {
  try {
    const { value } = req.body;
    const uid = req.user?.uid; 


    if (!uid) {
      return res.status(403).json({ error: "User not authenticated" });
    }

    const ref = firebaseDb.ref('khoa');
    await ref.set(value);

    await logUnlockHistory(req, res);

    res.status(200).json({ message: 'Khoa status updated successfully!',
     });
  } catch (error) {
    console.error("Error updating khoa status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Hàm ghi lại lịch sử đóng cửa
const logCloseHistory = async (historyId, closeTime) => {
  try {
    // Lấy bản ghi lịch sử mở khóa
    const unlockHistoryDoc = await db.collection('History').doc(historyId).get();
    console.log(unlockHistoryDoc)
    if (!unlockHistoryDoc.exists) {
      throw new Error("Unlock history record not found");
    }

    // Cập nhật trường closetime trong bản ghi lịch sử mở khóa của người mở cửa
    await db.collection('History').doc(historyId).update({
      closetime: closeTime  // Cập nhật thời gian đóng cửa
    });
    console.log(`Close time for history ID ${historyId} updated to: ${closeTime}`);

    // Kiểm tra lại dữ liệu sau khi cập nhật
    const updatedDoc = await db.collection('History').doc(historyId).get();
    console.log("Updated document:", updatedDoc.data()); // In ra dữ liệu sau khi cập nhật

  } catch (error) {
    console.error("Error logging close history:", error);
    throw error;
  }
};


// Hàm lấy trạng thái cửa
const getCuaStatus = async (req, res) => {
  try {
    const ref = firebaseDb.ref('cua'); // Lấy trạng thái cửa từ Firebase
    const snapshot = await ref.once('value'); // Lấy giá trị từ Firebase
    const value = snapshot.val(); // Trạng thái cửa (true: mở, false: đóng)

    res.status(200).json({ cua: value }); // Trả về trạng thái cửa
  } catch (error) {
    console.error("Error fetching cua status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

firebaseDb.ref('cua').on('value', async (snapshot) => {
  const value = snapshot.val();
  
  // Kiểm tra trạng thái cửa (cửa phải đóng mới cập nhật closetime)
  if (value === true) { 
    const closeTime = new Date().toISOString();

    // Lấy bản ghi lịch sử mở cửa để cập nhật closetime
    const historyQuery = db.collection('History')
      .where('closetime', '==', null)
      .orderBy('timestamp', 'desc') 
      .limit(1);
      
    const historySnapshot = await historyQuery.get();
    if (!historySnapshot.empty) {
      const historyDoc = historySnapshot.docs[0];
      const historyId = historyDoc.id;
      
      // Update Close
      await db.collection('History').doc(historyId).update({
        closetime: closeTime,
      });
      console.log("Closetime updated:", closeTime);
    } else {
    }
  }
});





module.exports = { 
  signup, 
  login, 
  logout, 
  changePassword,
  getKhoaStatus, 
  updateKhoaStatus, 
  logUnlockHistory, 
  // updateCuaStatus, 
  getCuaStatus,
  logCloseHistory,
  };

