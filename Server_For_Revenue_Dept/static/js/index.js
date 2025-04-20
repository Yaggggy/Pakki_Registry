async function connectToBlockchain() {
  // checking Meta-Mask extension is added or not
  if (typeof window.ethereum !== 'undefined') {
    try {
      alertUser('Connecting to MetaMask...', 'alert-info', 'block');
      showTransactionLoading();
      
      // Load contracts first
      try {
        await window.contractsLoaded;
      } catch (error) {
        console.error("Error loading contracts:", error);
        closeTransactionLoading();
        alertUser('Error loading contracts. Please try again.', 'alert-danger', 'block');
        return;
      }
      
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Initialize Web3
      window.web3 = new Web3(window.ethereum);

      // Store the connected account
      window.localStorage.setItem("employeeId", accounts[0].toLowerCase());
      window.employeeId = accounts[0].toLowerCase();

      // Update UI
      closeTransactionLoading();
      document.getElementById("connectToBlockchainDiv").style.display = "none";
      document.getElementById("passwordDiv").style.display = "block";
      alertUser('Enter Your Password', 'alert-success', 'block');

    } catch (error) {
      console.error("Connection error:", error);
      closeTransactionLoading();
      if (error.code === 4001) {
        alertUser('Please connect your wallet to continue', 'alert-danger', 'block');
      } else if (error.message === 'No accounts found') {
        alertUser('No accounts found in MetaMask. Please add an account.', 'alert-danger', 'block');
      } else {
        alertUser('Failed to connect wallet. Please try again.', 'alert-danger', 'block');
      }
    }
  } else {
    alertUser('Please install MetaMask to use this application', 'alert-danger', 'block');
  }
}

function login() {
    let employeeId = window.localStorage["employeeId"].toLowerCase();
    let password = document.getElementById("password").value;

    if (password === "") {
        alertUser('Please enter password', 'alert-danger', 'block');
        return;
    }

    // Create FormData object
    const formData = new FormData();
    formData.append('employeeId', employeeId);
    formData.append('password', password);

    // Show loading state
    showTransactionLoading();
    document.getElementById("loadingDiv").innerHTML = "Verifying credentials...";

    // Make API call to verify credentials
    fetch('/login', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        closeTransactionLoading();
        if (data.status === 1) {
            window.localStorage.revenueDepartmentId = data.revenueDepartmentId;
            window.localStorage.empName = data.empName;
            window.location.href = '/dashboard';
        } else {
            alertUser(data.msg || 'Invalid credentials', 'alert-danger', 'block');
        }
    })
    .catch(error => {
        closeTransactionLoading();
        console.error('Error:', error);
        alertUser('An error occurred. Please try again.', 'alert-danger', 'block');
    });
}

function showTransactionLoading() {
    const loadingDiv = document.getElementById("loadingDiv");
    loadingDiv.style.display = "block";
    loadingDiv.style.color = "black";
    loadingDiv.innerHTML = "Loading...";
}

function closeTransactionLoading() {
    const loadingDiv = document.getElementById("loadingDiv");
    loadingDiv.style.display = "none";
    loadingDiv.innerHTML = "";
}

// show error reason to user
function showError(errorOnTransaction) {
  errorCode = errorOnTransaction.code;

  if(errorCode==4001){
    return "Rejected Transaction";
  }
  else{
    let start = errorOnTransaction.message.indexOf('{');
    let end = -1;
  
    errorObj = JSON.parse(errorOnTransaction.message.slice(start, end));
  
    errorObj = errorObj.value.data.data;
  
    txHash = Object.getOwnPropertyNames(errorObj)[0];
  
    let reason = errorObj[txHash].reason;
  
    return reason;
  }
}

function alertUser(msg, msgType, display) {
  const notifyUser = document.getElementById("notifyUser");
  notifyUser.classList = [];
  notifyUser.classList.add("alert");
  notifyUser.classList.add(msgType);
  notifyUser.innerText = msg;
  notifyUser.style.display = display;
}

