import * as React from 'react';
import useEventCallback from '@mui/utils/useEventCallback';
import useForkRef from '@mui/utils/useForkRef';
import useEnhancedEffect from '@mui/utils/useEnhancedEffect';
import { TreeViewItemPlugin, TreeViewItemMeta, TreeViewPlugin } from '../../models';
import { UseTreeViewJSXItemsSignature } from './useTreeViewJSXItems.types';
import { publishTreeViewEvent } from '../../utils/publishTreeViewEvent';
import { useTreeViewContext } from '../../TreeViewProvider/useTreeViewContext';
import {
  TreeViewChildrenItemContext,
  TreeViewChildrenItemProvider,
} from '../../TreeViewProvider/TreeViewChildrenItemProvider';
import { TREE_VIEW_ROOT_PARENT_ID } from '../useTreeViewItems/useTreeViewItems.utils';
import type { TreeItemProps } from '../../../TreeItem';
import type { TreeItem2Props } from '../../../TreeItem2';
import { UseTreeViewIdSignature } from '../useTreeViewId';

export const useTreeViewJSXItems: TreeViewPlugin<UseTreeViewJSXItemsSignature> = ({
  instance,
  setState,
}) => {
  instance.preventItemUpdates();

  const insertJSXItem = useEventCallback((item: TreeViewItemMeta) => {
    setState((prevState) => {
      if (prevState.items.itemMetaMap[item.id] != null) {
        throw new Error(
          [
            'MUI X: The Tree View component requires all items to have a unique `id` property.',
            'Alternatively, you can use the `getItemId` prop to specify a custom id for each item.',
            `Two items were provided with the same id in the \`items\` prop: "${item.id}"`,
          ].join('\n'),
        );
      }

      return {
        ...prevState,
        items: {
          ...prevState.items,
          itemMetaMap: { ...prevState.items.itemMetaMap, [item.id]: { ...item, index: -1 } },
          // For `SimpleTreeView`, we don't have a proper `item` object, so we create a very basic one.
          itemMap: { ...prevState.items.itemMap, [item.id]: { id: item.id, label: item.label } },
        },
      };
    });
  });

  const setJSXItemsOrderedChildrenIds = (parentId: string | null, orderedChildrenIds: string[]) => {
    setState((prevState) => ({
      ...prevState,
      items: {
        ...prevState.items,
        itemOrderedChildrenIds: {
          ...prevState.items.itemOrderedChildrenIds,
          [parentId ?? TREE_VIEW_ROOT_PARENT_ID]: orderedChildrenIds,
        },
      },
    }));
  };

  const removeJSXItem = useEventCallback((itemId: string) => {
    setState((prevState) => {
      const newItemMetaMap = { ...prevState.items.itemMetaMap };
      const newItemMap = { ...prevState.items.itemMap };
      delete newItemMetaMap[itemId];
      delete newItemMap[itemId];
      return {
        ...prevState,
        items: {
          ...prevState.items,
          itemMetaMap: newItemMetaMap,
          itemMap: newItemMap,
        },
      };
    });
    publishTreeViewEvent(instance, 'removeItem', { id: itemId });
  });

  const mapFirstCharFromJSX = useEventCallback((itemId: string, firstChar: string) => {
    instance.updateFirstCharMap((firstCharMap) => {
      firstCharMap[itemId] = firstChar;
      return firstCharMap;
    });

    return () => {
      instance.updateFirstCharMap((firstCharMap) => {
        const newMap = { ...firstCharMap };
        delete newMap[itemId];
        return newMap;
      });
    };
  });

  return {
    instance: {
      insertJSXItem,
      removeJSXItem,
      setJSXItemsOrderedChildrenIds,
      mapFirstCharFromJSX,
    },
  };
};

const useTreeViewJSXItemsItemPlugin: TreeViewItemPlugin<TreeItemProps | TreeItem2Props> = ({
  props,
  rootRef,
  contentRef,
}) => {
  const { instance } = useTreeViewContext<[UseTreeViewIdSignature, UseTreeViewJSXItemsSignature]>();
  const { children, disabled = false, label, itemId, id } = props;

  const parentContext = React.useContext(TreeViewChildrenItemContext);
  if (parentContext == null) {
    throw new Error(
      [
        'MUI X: Could not find the Tree View Children Item context.',
        'It looks like you rendered your component outside of a SimpleTreeView parent component.',
        'This can also happen if you are bundling multiple versions of the Tree View.',
      ].join('\n'),
    );
  }
  const { registerChild, unregisterChild, parentId } = parentContext;

  const isExpandable = (reactChildren: React.ReactNode) => {
    if (Array.isArray(reactChildren)) {
      return reactChildren.length > 0 && reactChildren.some(isExpandable);
    }
    return Boolean(reactChildren);
  };

  const expandable = isExpandable(children);

  const pluginContentRef = React.useRef<HTMLDivElement>(null);
  const handleContentRef = useForkRef(pluginContentRef, contentRef);

  // Prevent any flashing
  useEnhancedEffect(() => {
    const idAttributeWithDefault = instance.getTreeItemIdAttribute(itemId, id);
    registerChild(idAttributeWithDefault, itemId);

    return () => {
      unregisterChild(idAttributeWithDefault);
    };
  }, [instance, registerChild, unregisterChild, itemId, id]);

  React.useEffect(() => {
    instance.insertJSXItem({
      id: itemId,
      idAttribute: id,
      parentId,
      expandable,
      disabled,
    });

    return () => instance.removeJSXItem(itemId);
  }, [instance, parentId, itemId, expandable, disabled, id]);

  React.useEffect(() => {
    if (label) {
      return instance.mapFirstCharFromJSX(
        itemId,
        (pluginContentRef.current?.textContent ?? '').substring(0, 1).toLowerCase(),
      );
    }
    return undefined;
  }, [instance, itemId, label]);

  return {
    contentRef: handleContentRef,
    rootRef,
  };
};

useTreeViewJSXItems.itemPlugin = useTreeViewJSXItemsItemPlugin;

useTreeViewJSXItems.wrapItem = ({ children, itemId }) => (
  <TreeViewChildrenItemProvider itemId={itemId}>{children}</TreeViewChildrenItemProvider>
);

useTreeViewJSXItems.wrapRoot = ({ children }) => (
  <TreeViewChildrenItemProvider>{children}</TreeViewChildrenItemProvider>
);

useTreeViewJSXItems.params = {};
