// Web3 and Contract Setup
let web3;
let landRegistryContract;
let userAccount;

async function initializeWeb3AndContracts() {
    try {
        // Initialize Web3
        if (window.ethereum) {
            web3 = new Web3(window.ethereum);
            const accounts = await web3.eth.getAccounts();
            userAccount = accounts[0];
            
            // Fetch contract details
            const response = await fetch('/fetchContractDetails');
            const contractDetails = await response.json();
            
            // Initialize LandRegistry contract
            landRegistryContract = new web3.eth.Contract(
                contractDetails.LandRegistry.abi,
                contractDetails.LandRegistry.address
            );
            
            return true;
        } else {
            throw new Error('MetaMask is not installed');
        }
    } catch (error) {
        console.error('Failed to initialize Web3:', error);
        return false;
    }
}

async function checkConnection() {
    // checking Meta-Mask extension is added or not
    if (window.ethereum) {
        try {
            // Show loading overlay
            showLoading("Connecting to MetaMask...");
            
            // Initialize Web3 and contracts
            const initialized = await initializeWeb3AndContracts();
            if (!initialized) {
                throw new Error('Failed to initialize Web3 and contracts');
            }
            
            // Request account access using the recommended method
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found in MetaMask');
            }

            const accountConnectedToMetaMask = accounts[0].toLowerCase();
            const storedAccount = window.localStorage["employeeId"].toLowerCase();

            if (accountConnectedToMetaMask !== storedAccount) {
                throw new Error("Account mismatch. Please login with the correct account.");
            }

            // Update UI with user info
            document.getElementById("revenueDeptId").innerText = window.localStorage.revenueDepartmentId;
            document.getElementById('nameOfUser').innerText = window.localStorage.empName;
            
            // Fetch properties
            await fetchPropertiesUnderControl(window.localStorage.revenueDepartmentId);

            // Hide loading overlay
            hideLoading();

        } catch (error) {
            console.error("Connection error:", error);
            hideLoading();
            
            if (error.message.includes("Account mismatch")) {
                alert("Please login with the correct MetaMask account");
                window.location.href = "/";
            } else {
                alert(error.message || "Failed to connect to MetaMask");
            }
        }
    } else {
        hideLoading();
        alert("Please install MetaMask extension!");
    }
}

async function loadContractDetails() {
    try {
        const response = await fetch('/static/js/contractsDetails.js');
        const contractDetails = await response.json();
        
        contract = new web3.eth.Contract(
            contractDetails.abi,
            contractDetails.address
        );
    } catch (error) {
        console.error('Error loading contract details:', error);
        showNotification('Failed to load contract details', 'error');
    }
}

async function loadProperties() {
    try {
        const deptId = await contract.methods.getEmployeeDeptId(userAccount).call();
        const properties = await contract.methods.getPropertiesForRevenueDept(deptId).call();
        
        const tableBody = document.getElementById('propertiesTableBody');
        tableBody.innerHTML = '';
        
        properties.forEach(property => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${property.propertyId}</td>
                <td>${property.locationId}</td>
                <td>${property.surveyNumber}</td>
                <td>${property.area}</td>
                <td>
                    <button onclick="viewDocument('${property.documentUrl}')" class="view-doc-btn">
                        View Documents
                    </button>
                </td>
                <td class="status-${property.status.toLowerCase()}">${property.status}</td>
            `;
            
            if (property.status === 'Pending') {
                const actionCell = document.createElement('td');
                actionCell.innerHTML = `
                    <button onclick="verifyProperty(${property.propertyId})" class="action-btn verify-btn">
                        Verify
                    </button>
                    <button onclick="rejectProperty(${property.propertyId})" class="action-btn reject-btn">
                        Reject
                    </button>
                `;
                row.appendChild(actionCell);
            }
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading properties:', error);
        showNotification('Failed to load properties', 'error');
    }
}

async function verifyProperty(propertyId) {
    try {
        await contract.methods.verifyProperty(propertyId).send({ from: userAccount });
        showNotification('Property verified successfully', 'success');
        await loadProperties();
    } catch (error) {
        console.error('Error verifying property:', error);
        showNotification('Failed to verify property', 'error');
    }
}

async function rejectProperty(propertyId) {
    try {
        await contract.methods.rejectProperty(propertyId).send({ from: userAccount });
        showNotification('Property rejected', 'warning');
        await loadProperties();
    } catch (error) {
        console.error('Error rejecting property:', error);
        showNotification('Failed to reject property', 'error');
    }
}

function viewDocument(documentUrl) {
    const pdfPopup = document.getElementById('pdfPopup');
    const pdfFrame = document.getElementById('pdfFrame');
    
    pdfFrame.src = documentUrl;
    pdfPopup.style.display = 'block';
    
    // Animate popup
    gsap.from(pdfPopup, {
        duration: 0.5,
        scale: 0.8,
        opacity: 0,
        ease: "back.out(1.7)"
    });
}

function closePdf() {
    const pdfPopup = document.getElementById('pdfPopup');
    
    // Animate popup close
    gsap.to(pdfPopup, {
        duration: 0.3,
        scale: 0.8,
        opacity: 0,
        ease: "power2.in",
        onComplete: () => {
            pdfPopup.style.display = 'none';
            document.getElementById('pdfFrame').src = '';
        }
    });
}

function showNotification(message, type) {
    const notifyUser = document.getElementById('notifyUser');
    notifyUser.textContent = message;
    notifyUser.className = `alert alert-${type}`;
    
    // Add CSS class for animation
    notifyUser.style.display = 'block';
    notifyUser.style.opacity = '0';
    notifyUser.style.transform = 'translateX(100px)';
    
    // Trigger animation
    setTimeout(() => {
        notifyUser.style.opacity = '1';
        notifyUser.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        notifyUser.style.opacity = '0';
        notifyUser.style.transform = 'translateX(100px)';
        
        // Hide completely after animation
        setTimeout(() => {
            notifyUser.style.display = 'none';
        }, 300);
    }, 3000);
}

// Event Listeners
window.ethereum.on('accountsChanged', function (accounts) {
    userAccount = accounts[0];
    checkConnection();
});

window.ethereum.on('chainChanged', function () {
    window.location.reload();
});

async function fetchPropertiesUnderControl(revenueDepartmentId) {
    try {
        showLoading("Fetching properties...");
        
        if (!landRegistryContract) {
            throw new Error('Contract not initialized');
        }

        console.log("Fetching properties for Revenue Dept ID:", revenueDepartmentId);

        // Get properties
        const properties = await landRegistryContract.methods
            .getPropertiesByRevenueDeptId(revenueDepartmentId)
            .call();

        console.log("Fetched properties:", properties);

        // Update UI with properties
        const tableBody = document.getElementById('propertiesTableBody');
        tableBody.innerHTML = ''; // Clear existing rows

        if (properties && properties.length > 0) {
            properties.forEach(property => {
                const row = document.createElement('tr');
                
                // Extract property details (handling both object and array formats)
                const propertyId = property.propertyId || property[0];
                const locationId = property.locationId || property[1];
                const surveyNumber = property.surveyNumber || property[3];
                const area = property.area || property[4];
                const state = property.state || property[11]; // State is at index 11

                row.innerHTML = `
                    <td>${propertyId || '-'}</td>
                    <td>${locationId || '-'}</td>
                    <td>${surveyNumber || '-'}</td>
                    <td>${area || '-'}</td>
                    <td><button onclick="showPdf('${propertyId}')" class="btn btn-primary">View Documents</button></td>
                    <td>${handleStateOfProperty(property)}</td>
                `;

                // Add action buttons only for properties in Created state (0)
                if (Number(state) === 0) {
                    const actionCell = document.createElement('td');
                    actionCell.innerHTML = `
                        <button onclick="acceptProperty(${propertyId})" class="btn btn-success">Verify</button>
                        <button onclick="rejectProperty(${propertyId})" class="btn btn-danger">Reject</button>
                    `;
                    row.appendChild(actionCell);
                } else {
                    row.appendChild(document.createElement('td')); // Empty cell for consistency
                }

                tableBody.appendChild(row);
            });

            // Update the property counts in the dashboard
            updatePropertyCounts(properties);

        } else {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No properties found</td></tr>';
            resetPropertyCounts();
        }

        hideLoading();

    } catch (error) {
        console.error('Error fetching properties:', error);
        hideLoading();
        showNotification('Failed to fetch properties: ' + error.message, 'error');
    }
}

function handleStateOfProperty(property) {
    // Get state value (handling both object and array formats)
    const state = Number(property.state || property[11]);
    
    // Match the smart contract's StateOfProperty enum
    // enum StateOfProperty { Created, Scheduled, Verified, Rejected, OnSale, Bought }
    switch (state) {
        case 0:
            return '<span class="status-pending">Pending Verification</span>';
        case 1:
            return '<span class="status-scheduled">Scheduled</span>';
        case 2:
            return '<span class="status-verified">Verified</span>';
        case 3:
            return '<span class="status-rejected">Rejected</span>';
        case 4:
            return '<span class="status-onsale">On Sale</span>';
        case 5:
            return '<span class="status-bought">Bought</span>';
        default:
            return '<span class="status-unknown">Unknown</span>';
    }
}

async function acceptProperty(propertyId) {
    try {
        showLoading("Verifying property...");
        
        if (!landRegistryContract) {
            throw new Error('Contract not initialized');
        }

        await landRegistryContract.methods.verifyProperty(propertyId)
            .send({ from: window.localStorage.employeeId });
            
        showNotification('Property verified successfully', 'success');
        await fetchPropertiesUnderControl(window.localStorage.revenueDepartmentId);
    } catch (error) {
        console.error('Error verifying property:', error);
        showNotification('Failed to verify property: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function rejectProperty(propertyId) {
    try {
        showLoading("Rejecting property...");
        
        if (!landRegistryContract) {
            throw new Error('Contract not initialized');
        }

        await landRegistryContract.methods.rejectProperty(propertyId, "Rejected by revenue department")
            .send({ from: window.localStorage.employeeId });
            
        showNotification('Property rejected successfully', 'warning');
        await fetchPropertiesUnderControl(window.localStorage.revenueDepartmentId);
    } catch (error) {
        console.error('Error rejecting property:', error);
        showNotification('Failed to reject property: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function updatePropertyCounts(properties) {
    let pending = 0, verified = 0, rejected = 0;
    
    if (!properties || !Array.isArray(properties)) {
        console.error('Invalid properties data:', properties);
        resetPropertyCounts();
        return;
    }

    console.log('Updating property counts for', properties.length, 'properties');
    
    properties.forEach(property => {
        // Get state value (handling both object and array formats)
        const state = Number(property.state || property[11]);
        console.log('Property state:', state);
        
        // Update counts based on state
        switch (state) {
            case 0: // Created/Pending
                pending++;
                break;
            case 2: // Verified
            case 4: // OnSale (counts as verified)
            case 5: // Bought (counts as verified)
                verified++;
                break;
            case 3: // Rejected
                rejected++;
                break;
        }
    });
    
    console.log('Counts - Pending:', pending, 'Verified:', verified, 'Rejected:', rejected);
    
    // Update the UI counters
    const pendingElement = document.getElementById('pendingCount');
    const verifiedElement = document.getElementById('verifiedCount');
    const rejectedElement = document.getElementById('rejectedCount');
    
    if (pendingElement) pendingElement.textContent = pending;
    if (verifiedElement) verifiedElement.textContent = verified;
    if (rejectedElement) rejectedElement.textContent = rejected;
}

function resetPropertyCounts() {
    document.getElementById('pendingCount').textContent = '0';
    document.getElementById('verifiedCount').textContent = '0';
    document.getElementById('rejectedCount').textContent = '0';
}

// fucntion to show Registered pdfs
function showPdf(propertyId) {
    const frame = document.getElementById('pdf-frame');
    frame.src = `/propertiesDocs/pdf/${propertyId}`;
    
    const popup = document.querySelector('.pdf-popup');
    popup.style.display = 'block';
}

function closePopup() {
    const popup = document.querySelector('.pdf-popup');
    popup.style.display = 'none';
}

function showLoading(message) {
    const loadingDiv = document.getElementById('loadingDiv');
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.textContent = message;
    if (loadingDiv) loadingDiv.style.display = 'flex';
}

function hideLoading() {
    const loadingDiv = document.getElementById('loadingDiv');
    if (loadingDiv) loadingDiv.style.display = 'none';
}
