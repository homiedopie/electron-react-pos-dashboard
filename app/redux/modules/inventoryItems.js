const FETCH_ALL_ITEMS = 'FETCH_ALL_ITEMS';
const NEW_ITEM = 'NEW_ITEM';
const UPDATE_ITEM = 'UPDATE_ITEM';
const REMOVE_ITEMS = 'REMOVE_ITEMS';

const ITEM_STOCK_UPDATED = 'ITEM_STOCK_UPDATED';
const ALL_ITEMS_FETCHED = 'ALL_ITEMS_FETCHED';
const NEW_ITEM_SYNCED = 'NEW_ITEM_SYNCED';
const UPDATE_ITEM_SYNCED = 'UPDATE_ITEM_SYNCED';
const REMOVE_ITEMS_SYNCED = 'REMOVE_ITEMS_SYNCED';

export default function reducer(state = [], action) {
  switch (action.type) {
    case ALL_ITEMS_FETCHED:
      return Object.keys(action.items)
        .map(key => action.items[key]);
    case NEW_ITEM:
      return [
        ...state,
        action.newItem
      ];
    case UPDATE_ITEM:
      return state.map(item => (item.id === action.itemId ?
        { ...item, ...action.itemProps } : item));
    case REMOVE_ITEMS:
      return state.filter(item => action.items.indexOf(item) === -1);
    case ITEM_STOCK_UPDATED:
      return state.map(item => (item.id === action.item.id ? action.item : item));
    default:
      return state;
  }
}

export function addNewItem(item) {
  return (dispatch, _, { ref, storage, timestamp }) => {
    function addInvItem(props) {
      ref.child(`inventory/${props.id}`)
      .set({ ...props, initialStock: props.stock, timestamp })
      .then(() => dispatch({ type: NEW_ITEM_SYNCED }));
    }

    if (item.image && item.image[0]) {
      const path = `itemImages/${item.id}.jpg`;
      const uploadTask = storage.child(path).put(item.image[0]);
      const reader = new FileReader();

      reader.onload = (e) => {
        const newItem = {
          ...item,
          initialStock: item.stock,
          image: e.target.result
        };

        dispatch({ type: NEW_ITEM, newItem });
      };
      reader.readAsDataURL(item.image[0]);

      uploadTask.on('state_changed', (snap) => { // TODO: add progress indicator
        console.log(snap);
      }, (err) => {
        console.log(err);
      }, () => {
        const newItem = {
          ...item,
          image: uploadTask.snapshot.downloadURL
        };

        addInvItem(newItem);
      });
    } else {
      dispatch({ type: NEW_ITEM, newItem: { ...item, initialStock: item.stock } });
      addInvItem(item);
    }
  };
}

export function updateItem(itemId, itemProps) {
  return (dispatch, _, { ref, storage }) => {
    function updateInvItem(props) {
      if (props.stock) {
        ref.child(`inventory/${itemId}`)
        .update({ ...props, initialStock: props.stock })
        .then(() => dispatch({ type: UPDATE_ITEM_SYNCED, itemId, itemProps }));
      } else {
        ref.child(`inventory/${itemId}`)
        .update(props)
        .then(() => dispatch({ type: UPDATE_ITEM_SYNCED, itemId, itemProps }));
      }
    }

    function readFile() {
      const reader = new FileReader();

      reader.onload = (e) => {
        const newItemProps = {
          ...itemProps,
          image: e.target.result
        };

        dispatch({ type: UPDATE_ITEM, itemId, itemProps: newItemProps });
      };
      reader.readAsDataURL(itemProps.image[0]);
    }

    function syncImage() {
      const path = `itemImages/${itemId}.jpg`;
      const uploadTask = storage.child(path).put(itemProps.image[0]);

      uploadTask.on('state_changed', (snap) => { // TODO: add progress indicator
        console.log(snap);
      }, (err) => {
        console.log(err);
      }, () => {
        const newItemProps = {
          ...itemProps,
          image: uploadTask.snapshot.downloadURL
        };

        updateInvItem(newItemProps);
      });
    }

    function updateInvItemId() {
      const oldChild = ref.child(`inventory/${itemId}`);
      oldChild.once('value', snap => {
        const newChildVal = { ...snap.val(), itemProps };

        ref.child(`inventory/${itemProps.id}`).set(newChildVal);
        oldChild.remove()
        .then(() => dispatch({ type: UPDATE_ITEM_SYNCED }));
      });
    }

    if (itemProps.id) {
      if (itemProps.image && itemProps.image[0]) {
        readFile();
        syncImage();
        updateInvItemId();
      } else {
        dispatch({ type: UPDATE_ITEM, itemId, itemProps });
        updateInvItemId();
      }
    } else {
      if (itemProps.image && itemProps.image[0]) {
        readFile();
        syncImage();
      } else {
        dispatch({ type: UPDATE_ITEM, itemId, itemProps });
        updateInvItem(itemProps);
      }
    }
  };
}

export function removeItems(items) {
  return (dispatch, _, { ref, storage }) => {
    const itemsToDel = {};

    dispatch({ type: REMOVE_ITEMS, items });
    items.forEach(item => {
      storage.child(`itemImages/${item.id}.jpg`).delete()
      .then(() => console.log(`${item} image deleted`));

      itemsToDel[item.id] = null;
    });

    ref.child('inventory')
    .update(itemsToDel)
    .then(() => dispatch({ type: REMOVE_ITEMS_SYNCED }));
  };
}

export function fetchInventoryItems() {
  return (dispatch, getState, { ref }) => {
    dispatch({ type: FETCH_ALL_ITEMS });

    ref.child('inventory').once('value')
    .then(snap => dispatch({ type: ALL_ITEMS_FETCHED, items: snap.val() || [] }))
    .then(() => {
      ref.child('inventory').on('child_changed', snap => {
        const item = snap.val();
        const origItem = getState().inventory
        .items.reduce((prev, curr) => (prev.id === item.id ? prev : curr));

        if (origItem.stock !== item.stock) {
          dispatch({ type: ITEM_STOCK_UPDATED, item });
        }
      });
    });
  };
}