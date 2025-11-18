// assets/js/app.js
import {
  auth,
  db,
  signInAnonymously,
  onAuthStateChanged,
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "./firebase-config.js";

let currentUser = null;
let userNickname = localStorage.getItem("matjipNickname") || null;

let restaurants = [];
let activeCategory = "ALL";
let searchTerm = "";
let currentRestaurantId = null;
let unsubscribeReviews = null;

// DOM
const restaurantListEl = document.getElementById("restaurantList");
const categoryFiltersEl = document.getElementById("categoryFilters");
const searchInputEl = document.getElementById("searchInput");
const nicknameDisplayEl = document.getElementById("nicknameDisplay");

const detailEmptyEl = document.getElementById("detailEmpty");
const detailContentEl = document.getElementById("detailContent");

// detail info elements
const detailNameEl = document.getElementById("detail-name");
const detailLocationEl = document.getElementById("detail-location");
const detailFriendlyLocationEl = document.getElementById(
  "detail-friendlyLocation"
);
const detailCategoriesEl = document.getElementById("detail-categories");
const detailImageWrapperEl = document.getElementById("detail-imageWrapper");
const detailImageEl = document.getElementById("detail-image");
const detailImageLinkEl = document.getElementById("detail-imageLink");
const detailMenuEl = document.getElementById("detail-menu");
const detailMoodEl = document.getElementById("detail-mood");
const detailWaitingEl = document.getElementById("detail-waiting");
const detailSmellEl = document.getElementById("detail-smell");
const detailPriceEl = document.getElementById("detail-price");
const detailEtcEl = document.getElementById("detail-etc");
const detailHashtagsEl = document.getElementById("detail-hashtags");
const hashtagEditorEl = document.getElementById("hashtagEditor");
const hashtagInputEl = document.getElementById("hashtagInput");
const hashtagSaveBtnEl = document.getElementById("hashtagSaveBtn");
const hashtagEditHintEl = document.getElementById("hashtagEditHint");

// 리뷰 탭 요소
const detailRatingStarsEl = document.getElementById("detail-ratingStars");
const detailRatingTextEl = document.getElementById("detail-ratingText");
const detailRatingCountEl = document.getElementById("detail-ratingCount");
const currentNicknameLabelEl = document.getElementById("currentNicknameLabel");
const reviewRatingEl = document.getElementById("reviewRating");
const reviewCommentEl = document.getElementById("reviewComment");
const reviewSubmitBtnEl = document.getElementById("reviewSubmitBtn");
const reviewsListEl = document.getElementById("reviewsList");

// 지도 / 링크 탭 요소
const naverMapLinkEl = document.getElementById("naverMapLink");
const kakaoMapLinkEl = document.getElementById("kakaoMapLink");

// 모달 관련
const addModalEl = document.getElementById("addModal");
const openAddModalBtnEl = document.getElementById("openAddModalBtn");
const closeAddModalBtnEl = document.getElementById("closeAddModalBtn");
const cancelAddBtnEl = document.getElementById("cancelAddBtn");
const addRestaurantFormEl = document.getElementById("addRestaurantForm");

/* -------------------- 초기화 -------------------- */

async function initAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        updateNicknameDisplay();
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          currentUser = cred.user;
          updateNicknameDisplay();
          resolve(cred.user);
        } catch (e) {
          console.error("익명 로그인 실패:", e);
          resolve(null);
        }
      }
    });
  });
}

function updateNicknameDisplay() {
  if (userNickname) {
    if (nicknameDisplayEl) {
      nicknameDisplayEl.classList.remove("hidden");
      nicknameDisplayEl.textContent = `닉네임: ${userNickname}`;
    }
    if (currentNicknameLabelEl) {
      currentNicknameLabelEl.textContent = `현재 닉네임: ${userNickname}`;
    }
  } else {
    if (nicknameDisplayEl) {
      nicknameDisplayEl.classList.add("hidden");
      nicknameDisplayEl.textContent = "";
    }
    if (currentNicknameLabelEl) {
      currentNicknameLabelEl.textContent =
        "후기를 남기면 닉네임을 설정하게 됩니다.";
    }
  }
}

/* -------------------- 맛집 데이터 구독 -------------------- */

function subscribeRestaurants() {
  const restaurantsRef = collection(db, "restaurants");
  const q = query(restaurantsRef, orderBy("createdAt", "desc"));

  onSnapshot(
    q,
    (snapshot) => {
      restaurants = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      renderRestaurantList();
      updateDetailPanelAfterRestaurantsChange();
    },
    (err) => {
      console.error("restaurants snapshot error:", err);
    }
  );
}

function applyFilters(list) {
  let filtered = list;

  if (activeCategory !== "ALL") {
    filtered = filtered.filter(
      (r) => Array.isArray(r.categories) && r.categories.includes(activeCategory)
    );
  }

  if (searchTerm.trim() !== "") {
    const term = searchTerm.trim().toLowerCase();
    filtered = filtered.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const location = (r.location || "").toLowerCase();
      const friendly = (r.friendlyLocation || "").toLowerCase();
      const menu = (r.menu || "").toLowerCase();
      const hashtags = Array.isArray(r.hashtags)
        ? r.hashtags.join(" ").toLowerCase()
        : "";
      return (
        name.includes(term) ||
        location.includes(term) ||
        friendly.includes(term) ||
        menu.includes(term) ||
        hashtags.includes(term)
      );
    });
  }

  return filtered;
}

/* -------------------- 맛집 리스트 렌더링 -------------------- */

function renderRestaurantList() {
  if (!restaurantListEl) return;

  const filtered = applyFilters(restaurants);

  if (filtered.length === 0) {
    restaurantListEl.innerHTML =
      '<div class="col-span-full text-xs text-muted-light dark:text-muted-dark border border-dashed border-border-light dark:border-border-dark rounded-xl p-4">조건에 맞는 맛집이 아직 없어요. 새로운 맛집을 추가해볼까요?</div>';
    return;
  }

  restaurantListEl.innerHTML = "";

  filtered.forEach((r) => {
    const card = document.createElement("article");
    card.className =
      "flex flex-col gap-3 group bg-surface-light dark:bg-surface-dark p-4 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow";

    card.dataset.id = r.id;

    const ratingText =
      typeof r.ratingAvg === "number"
        ? r.ratingAvg.toFixed(1)
        : "N/A";
    const ratingCount = typeof r.ratingCount === "number" ? r.ratingCount : 0;

    const categoriesHtml = (r.categories || [])
      .map(
        (c) =>
          `<span class="text-[10px] font-medium px-2 py-1 bg-primary/20 dark:bg-primary/30 text-primary rounded-full">${c}</span>`
      )
      .join("");

    const hashtagsHtml = (r.hashtags || [])
      .map(
        (tag) =>
          `<span class="text-[10px] font-medium px-2 py-1 bg-primary/10 dark:bg-primary/20 text-primary rounded-full">#${tag}</span>`
      )
      .join("");

    const smellText = r.smell || "정보 없음";

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <h3 class="text-base font-bold leading-tight mb-1 line-clamp-2">${
            r.name || "(이름 없음)"
          }</h3>
          <p class="text-[11px] text-muted-light dark:text-muted-dark line-clamp-1 mb-1">${
            r.location || ""
          }</p>
          <p class="text-[11px] text-muted-light dark:text-muted-dark line-clamp-1">${
            r.friendlyLocation || ""
          }</p>
        </div>
        <div class="flex flex-col items-end gap-1">
          <div class="flex items-center gap-1 text-primary text-xs">
            ${renderStarsInline(r.ratingAvg || 0)}
            <span class="text-[11px] text-muted-light dark:text-muted-dark ml-1">(${
              ratingCount || 0
            })</span>
          </div>
          ${
            r.price
              ? `<div class="text-[11px] text-muted-light dark:text-muted-dark">${r.price}</div>`
              : ""
          }
        </div>
      </div>
      ${
        r.menu
          ? `<p class="text-[11px] text-muted-light dark:text-muted-dark line-clamp-2 mb-1">대표 메뉴: ${
              r.menu
            }</p>`
          : ""
      }
      <div class="flex flex-wrap gap-1 mb-1">
        ${categoriesHtml}
      </div>
      <div class="flex flex-wrap gap-1 mb-1">
        ${hashtagsHtml}
      </div>
      <p class="text-[11px] text-muted-light dark:text-muted-dark">냄새: ${smellText}</p>
    `;

    card.addEventListener("click", () => {
      selectRestaurant(r.id);
    });

    restaurantListEl.appendChild(card);
  });
}

function renderStarsInline(avg) {
  const full = Math.floor(avg);
  const half = avg - full >= 0.5;
  const max = 5;
  let html = "";
  for (let i = 1; i <= max; i++) {
    if (i <= full) {
      html +=
        '<span class="material-symbols-outlined !text-[14px] text-[#facc15]">star</span>';
    } else if (i === full + 1 && half) {
      html +=
        '<span class="material-symbols-outlined !text-[14px] text-[#facc15]">star_half</span>';
    } else {
      html +=
        '<span class="material-symbols-outlined !text-[14px] text-muted-light dark:text-muted-dark">star</span>';
    }
  }
  return html;
}

/* -------------------- 상세 패널 -------------------- */

function selectRestaurant(id) {
  currentRestaurantId = id;
  const restaurant = restaurants.find((r) => r.id === id);
  if (!restaurant) return;

  // 상세 패널 표시
  detailEmptyEl.classList.add("hidden");
  detailContentEl.classList.remove("hidden");

  // Info 탭 업데이트
  detailNameEl.textContent = restaurant.name || "";
  detailLocationEl.textContent = restaurant.location || "";
  detailFriendlyLocationEl.textContent =
    restaurant.friendlyLocation || "";

  // 카테고리
  detailCategoriesEl.innerHTML = "";
  (restaurant.categories || []).forEach((c) => {
    const span = document.createElement("span");
    span.className =
      "text-[10px] font-medium px-2 py-1 bg-primary/20 dark:bg-primary/30 text-primary rounded-full";
    span.textContent = c;
    detailCategoriesEl.appendChild(span);
  });

  // 이미지 URL 미리보기 (이미지 확장자면 img, 아니면 링크만)
  if (restaurant.imageUrl) {
    const url = restaurant.imageUrl;
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
    detailImageWrapperEl.classList.remove("hidden");
    if (isImage) {
      detailImageEl.src = url;
      detailImageEl.classList.remove("hidden");
    } else {
      // 이미지 확장자가 아니면 src 지우고 감추기
      detailImageEl.src = "";
      detailImageEl.classList.add("hidden");
    }
    detailImageLinkEl.href = url;
  } else {
    detailImageWrapperEl.classList.add("hidden");
  }

  detailMenuEl.textContent = restaurant.menu || "-";
  detailMoodEl.textContent = restaurant.mood || "-";
  detailWaitingEl.textContent = restaurant.waiting || "-";
  detailSmellEl.textContent = restaurant.smell || "-";
  detailPriceEl.textContent = restaurant.price || "-";
  detailEtcEl.textContent = restaurant.etc || "-";

  // 대표 해시태그
  renderHashtags(restaurant);

  // 리뷰 정보
  renderRatingSummary(restaurant);

  // 지도 링크
  const queryText = encodeURIComponent(
    `${restaurant.name || ""} ${restaurant.location || ""}`
  );
  naverMapLinkEl.href = `https://map.naver.com/p/search/${queryText}`;
  kakaoMapLinkEl.href = `https://map.kakao.com/?q=${queryText}`;

  // 리뷰 구독
  subscribeReviews(id);
}

function updateDetailPanelAfterRestaurantsChange() {
  if (!currentRestaurantId) return;
  const restaurant = restaurants.find((r) => r.id === currentRestaurantId);
  if (!restaurant) {
    // 삭제된 경우 등
    currentRestaurantId = null;
    detailContentEl.classList.add("hidden");
    detailEmptyEl.classList.remove("hidden");
    return;
  }
  // 이미 선택된 상태면 내용 갱신
  selectRestaurant(currentRestaurantId);
}

function renderHashtags(restaurant) {
  detailHashtagsEl.innerHTML = "";
  const tags = restaurant.hashtags || [];
  if (tags.length === 0) {
    detailHashtagsEl.innerHTML =
      '<span class="text-[11px] text-muted-light dark:text-muted-dark">아직 대표 해시태그가 없습니다.</span>';
  } else {
    tags.forEach((t) => {
      const span = document.createElement("span");
      span.className =
        "text-[10px] font-medium px-2 py-1 bg-primary/15 dark:bg-primary/25 text-primary rounded-full";
      span.textContent = `#${t}`;
      detailHashtagsEl.appendChild(span);
    });
  }

  // 편집 권한: creatorId == currentUser.uid
  if (currentUser && restaurant.creatorId === currentUser.uid) {
    hashtagEditorEl.classList.remove("hidden");
    hashtagEditHintEl.classList.remove("hidden");
    hashtagInputEl.value = tags.map((t) => `#${t}`).join(" ");
  } else {
    hashtagEditorEl.classList.add("hidden");
    hashtagEditHintEl.classList.remove("hidden");
    hashtagEditHintEl.textContent =
      "이 맛집을 등록한 사람만 대표 해시태그를 수정할 수 있어요.";
  }
}

/* -------------------- 리뷰 & 별점 -------------------- */

function renderRatingSummary(restaurant) {
  const avg = typeof restaurant.ratingAvg === "number" ? restaurant.ratingAvg : 0;
  const count =
    typeof restaurant.ratingCount === "number" ? restaurant.ratingCount : 0;

  detailRatingStarsEl.innerHTML = renderStarsInline(avg);
  if (count > 0) {
    detailRatingTextEl.textContent = `${avg.toFixed(1)} / 5.0`;
    detailRatingCountEl.textContent = `${count}개의 후기`;
  } else {
    detailRatingTextEl.textContent = "아직 별점이 없습니다.";
    detailRatingCountEl.textContent = "";
  }
}

function subscribeReviews(restaurantId) {
  if (unsubscribeReviews) {
    unsubscribeReviews();
    unsubscribeReviews = null;
  }

  const reviewsRef = collection(db, "restaurants", restaurantId, "reviews");
  const q = query(reviewsRef, orderBy("createdAt", "desc"));

  unsubscribeReviews = onSnapshot(
    q,
    (snapshot) => {
      const reviews = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      renderReviews(reviews);
    },
    (err) => {
      console.error("reviews snapshot error:", err);
    }
  );
}

function renderReviews(reviews) {
  reviewsListEl.innerHTML = "";

  if (reviews.length === 0) {
    reviewsListEl.innerHTML =
      '<p class="text-[11px] text-muted-light dark:text-muted-dark">아직 후기가 없습니다. 첫 번째 후기를 남겨보세요!</p>';
    return;
  }

  reviews.forEach((rv) => {
    const item = document.createElement("div");
    item.className =
      "rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark px-3 py-2";

    const starsHtml = renderStarsInline(rv.rating || 0);
    const createdAtStr = rv.createdAt?.toDate
      ? rv.createdAt.toDate().toLocaleString()
      : "";

    item.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-semibold">${
            rv.nickname || "익명"
          }</span>
          <div class="flex items-center gap-1">${starsHtml}</div>
        </div>
        <span class="text-[10px] text-muted-light dark:text-muted-dark">${createdAtStr}</span>
      </div>
      <p class="text-[11px] text-muted-light dark:text-muted-dark whitespace-pre-line">${
        rv.comment || ""
      }</p>
    `;

    reviewsListEl.appendChild(item);
  });
}

async function handleReviewSubmit() {
  if (!currentRestaurantId || !currentUser) return;

  // 닉네임 없으면 한 번만 설정
  if (!userNickname) {
    const input = window.prompt(
      "후기에 사용할 닉네임을 입력해주세요. (이 브라우저에서 계속 사용됩니다)"
    );
    if (!input || !input.trim()) {
      return;
    }
    userNickname = input.trim();
    localStorage.setItem("matjipNickname", userNickname);
    updateNicknameDisplay();
  }

  const rating = Number(reviewRatingEl.value || 0);
  const comment = reviewCommentEl.value.trim();

  if (!rating || rating < 1 || rating > 5) {
    alert("별점을 선택해주세요.");
    return;
  }

  const reviewRef = doc(
    db,
    "restaurants",
    currentRestaurantId,
    "reviews",
    currentUser.uid
  );

  try {
    await setDoc(
      reviewRef,
      {
        userId: currentUser.uid,
        nickname: userNickname,
        rating,
        comment,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    );

    // 평균 별점 재계산
    await recomputeRating(currentRestaurantId);
    reviewCommentEl.value = "";
  } catch (e) {
    console.error("리뷰 저장 실패:", e);
    alert("리뷰 저장 중 오류가 발생했습니다.");
  }
}

async function recomputeRating(restaurantId) {
  const reviewsRef = collection(db, "restaurants", restaurantId, "reviews");
  const snapshot = await getDocs(reviewsRef);

  let sum = 0;
  let count = 0;
  snapshot.forEach((d) => {
    const r = d.data();
    if (typeof r.rating === "number") {
      sum += r.rating;
      count += 1;
    }
  });

  const avg = count > 0 ? sum / count : 0;

  const restaurantRef = doc(db, "restaurants", restaurantId);
  await updateDoc(restaurantRef, {
    ratingAvg: avg,
    ratingCount: count
  });
}

/* -------------------- 맛집 추가 -------------------- */

async function handleAddRestaurantSubmit(e) {
  e.preventDefault();
  if (!currentUser) {
    alert("로그인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  const formData = new FormData(addRestaurantFormEl);

  const name = formData.get("name")?.toString().trim() || "";
  const location = formData.get("location")?.toString().trim() || "";
  const friendlyLocation =
    formData.get("friendlyLocation")?.toString().trim() || "";
  const menu = formData.get("menu")?.toString().trim() || "";
  const mood = formData.get("mood")?.toString().trim() || "";
  const waiting = formData.get("waiting")?.toString().trim() || "";
  const smell = formData.get("smell")?.toString().trim() || "";
  const price = formData.get("price")?.toString().trim() || "";
  const etc = ""; // 필요시 폼 필드 추가해서 사용
  const imageUrl = formData.get("imageUrl")?.toString().trim() || "";

  const categories = formData.getAll("categories").map((v) => v.toString());

  const hashtagsRaw = formData.get("hashtags")?.toString().trim() || "";
  const hashtags = hashtagsRaw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter((t) => t.length > 0);

  if (!name || !location) {
    alert("가게 이름과 위치는 필수입니다.");
    return;
  }

  // 닉네임 없으면 설정
  if (!userNickname) {
    const input = window.prompt(
      "이 맛집의 등록자 이름(닉네임)을 입력해주세요. (후기 닉네임과 동일하게 사용됩니다)"
    );
    if (!input || !input.trim()) {
      return;
    }
    userNickname = input.trim();
    localStorage.setItem("matjipNickname", userNickname);
    updateNicknameDisplay();
  }

  const newData = {
    name,
    location,
    friendlyLocation,
    menu,
    mood,
    waiting,
    smell,
    price,
    etc,
    imageUrl,
    categories,
    hashtags,
    creatorId: currentUser.uid,
    creatorNickname: userNickname,
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "restaurants"), newData);
    closeAddModal();
    addRestaurantFormEl.reset();
  } catch (e) {
    console.error("맛집 추가 실패:", e);
    alert("맛집 추가 중 오류가 발생했습니다.");
  }
}

/* -------------------- 해시태그 수정 -------------------- */

async function handleHashtagSave() {
  if (!currentRestaurantId || !currentUser) return;

  const restaurant = restaurants.find((r) => r.id === currentRestaurantId);
  if (!restaurant) return;
  if (restaurant.creatorId !== currentUser.uid) {
    alert("이 맛집을 등록한 사람만 해시태그를 수정할 수 있습니다.");
    return;
  }

  const raw = hashtagInputEl.value || "";
  const tags = raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter((t) => t.length > 0);

  try {
    const restaurantRef = doc(db, "restaurants", currentRestaurantId);
    await updateDoc(restaurantRef, { hashtags: tags });
  } catch (e) {
    console.error("해시태그 업데이트 실패:", e);
    alert("해시태그 저장 중 오류가 발생했습니다.");
  }
}

/* -------------------- 모달 -------------------- */

function openAddModal() {
  addModalEl.classList.remove("hidden");
  addModalEl.classList.add("flex");
}

function closeAddModal() {
  addModalEl.classList.add("hidden");
  addModalEl.classList.remove("flex");
}

/* -------------------- 이벤트 바인딩 -------------------- */

function bindEvents() {
  // 카테고리 필터
  if (categoryFiltersEl) {
    categoryFiltersEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;

      const category = btn.dataset.category || "ALL";
      activeCategory = category;

      // active 스타일
      const allBtns = categoryFiltersEl.querySelectorAll(".filter-btn");
      allBtns.forEach((b) => {
        if (b === btn) {
          b.classList.remove(
            "bg-surface-light",
            "dark:bg-surface-dark",
            "text-text-light",
            "dark:text-text-dark"
          );
          b.classList.add("bg-primary", "text-white");
        } else {
          b.classList.remove("bg-primary", "text-white");
          b.classList.add(
            "bg-surface-light",
            "dark:bg-surface-dark",
            "text-text-light",
            "dark:text-text-dark"
          );
        }
      });

      renderRestaurantList();
    });
  }

  // 검색
  if (searchInputEl) {
    searchInputEl.addEventListener("input", (e) => {
      searchTerm = e.target.value || "";
      renderRestaurantList();
    });
  }

  // 리뷰 저장
  if (reviewSubmitBtnEl) {
    reviewSubmitBtnEl.addEventListener("click", () => {
      handleReviewSubmit();
    });
  }

  // 해시태그 저장
  if (hashtagSaveBtnEl) {
    hashtagSaveBtnEl.addEventListener("click", () => {
      handleHashtagSave();
    });
  }

  // 모달 열고/닫기
  if (openAddModalBtnEl) {
    openAddModalBtnEl.addEventListener("click", () => {
      openAddModal();
    });
  }
  if (closeAddModalBtnEl) {
    closeAddModalBtnEl.addEventListener("click", () => {
      closeAddModal();
    });
  }
  if (cancelAddBtnEl) {
    cancelAddBtnEl.addEventListener("click", () => {
      closeAddModal();
    });
  }
  // 모달 외부 클릭 시 닫기
  if (addModalEl) {
    addModalEl.addEventListener("click", (e) => {
      if (e.target === addModalEl) {
        closeAddModal();
      }
    });
  }

  // 맛집 추가 폼
  if (addRestaurantFormEl) {
    addRestaurantFormEl.addEventListener("submit", handleAddRestaurantSubmit);
  }
}

/* -------------------- 부트스트랩 -------------------- */

(async function bootstrap() {
  await initAuth();
  bindEvents();
  subscribeRestaurants();
})();
