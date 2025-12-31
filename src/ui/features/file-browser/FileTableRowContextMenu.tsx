import {
  ContextMenuItem,
  ContextMenuList,
} from "@/lib/components/context-menu";
import { TextWithIcon } from "@/lib/components/text-with-icon";
import { GetFilesAndFoldersInDirectoryItem } from "@common/Contracts";
import { useSelector } from "@xstate/store/react";
import {
  StarOffIcon,
  StarIcon,
  CopyIcon,
  ScissorsIcon,
  ClipboardPasteIcon,
  Trash2Icon,
  PencilIcon,
  PencilLineIcon,
  FilePlusIcon,
  TagIcon,
  FolderCogIcon,
  FolderPlusIcon,
  ClipboardCopyIcon,
  FileArchiveIcon,
  FolderInputIcon,
  HardDriveIcon,
  ExternalLinkIcon,
  TerminalIcon,
  BoxSelectIcon,
} from "lucide-react";
import { setDefaultPath } from "./defaultPath";
import { dialogActions } from "./dialogStore";
import { directoryHelpers, directoryStore } from "./directoryStore/directory";
import { clipboardHelpers } from "./clipboardHelpers";
import { selectIsFavorite, favoritesStore } from "./favorites";
import {
  tagsStore,
  selectLastUsedTag,
  selectHasTag,
  selectTagName,
  TAG_COLOR_CLASSES,
} from "./tags";
import { useDirectoryContext } from "./DirectoryContext";
import { toast } from "@/lib/components/toast";
import { getWindowElectron, windowArgs } from "@/getWindowElectron";
import { useState, useEffect } from "react";
import { ApplicationInfo } from "@common/Contracts";
import { ArchiveHelpers } from "@common/ArchiveHelpers";
import { CommandHelpers } from "./CommandHelpers";
import { checkGlob } from "@/lib/functions/checkGlob";

export const FileTableRowContextMenu = ({
  item,
  close,
  tableData,
}: {
  item: GetFilesAndFoldersInDirectoryItem;
  close: () => void;
  tableData: GetFilesAndFoldersInDirectoryItem[];
}) => {
  const directoryId = useDirectoryContext().directoryId;
  const fullPath =
    item.fullPath ?? directoryHelpers.getFullPath(item.name, directoryId);
  const isFavorite = selectIsFavorite(fullPath)(favoritesStore.get());
  const itemIndex = tableData.findIndex((i) => i.name === item.name);

  const favoriteItem: ContextMenuItem = isFavorite
    ? {
        onClick: () => {
          favoritesStore.send({ type: "removeFavorite", fullPath });
          close();
        },
        view: (
          <TextWithIcon icon={StarOffIcon}>Remove from favorites</TextWithIcon>
        ),
      }
    : {
        onClick: () => {
          favoritesStore.send({
            type: "addFavorite",
            item: {
              fullPath,
              type: item.type,
            },
          });
          close();
        },
        view: <TextWithIcon icon={StarIcon}>Add to favorites</TextWithIcon>,
      };

  const directory =
    directoryStore.getSnapshot().context.directoriesById[directoryId];
  const selectionIndexes = directory.selection.indexes;
  const isSelected = itemIndex !== -1 && selectionIndexes.has(itemIndex);
  const selectedItems =
    isSelected && selectionIndexes.size > 0
      ? [...selectionIndexes].map((i) => tableData[i])
      : [item];

  const copyItem: ContextMenuItem = {
    onClick: () => {
      clipboardHelpers.copy(selectedItems, false, directoryId);
      close();
    },
    view: (
      <TextWithIcon icon={CopyIcon}>
        Copy
        {isSelected && selectionIndexes.size > 1
          ? ` (${selectionIndexes.size} items)`
          : ""}
      </TextWithIcon>
    ),
  };

  const cutItem: ContextMenuItem = {
    onClick: () => {
      clipboardHelpers.copy(selectedItems, true, directoryId);
      close();
    },
    view: (
      <TextWithIcon icon={ScissorsIcon}>
        Cut
        {isSelected && selectionIndexes.size > 1
          ? ` (${selectionIndexes.size} items)`
          : ""}
      </TextWithIcon>
    ),
  };

  const pasteItem: ContextMenuItem = {
    onClick: () => {
      clipboardHelpers.paste(directoryId);
      close();
    },
    view: <TextWithIcon icon={ClipboardPasteIcon}>Paste</TextWithIcon>,
  };

  const deleteItem: ContextMenuItem = {
    onClick: () => {
      directoryHelpers.handleDelete(selectedItems, tableData, directoryId);
      close();
    },
    view: (
      <TextWithIcon icon={Trash2Icon}>
        Delete
        {isSelected && selectionIndexes.size > 1
          ? ` (${selectionIndexes.size} items)`
          : ""}
      </TextWithIcon>
    ),
  };

  const renameItem: ContextMenuItem = {
    onClick: () => {
      dialogActions.open("rename", item);
      close();
    },
    view: <TextWithIcon icon={PencilIcon}>Rename</TextWithIcon>,
  };

  const batchRenameItem: ContextMenuItem | null =
    isSelected && selectionIndexes.size > 1
      ? {
          onClick: () => {
            dialogActions.open("batchRename", selectedItems);
            close();
          },
          view: (
            <TextWithIcon icon={PencilLineIcon}>
              Batch Rename ({selectionIndexes.size} items)
            </TextWithIcon>
          ),
        }
      : null;

  const newFileItem: ContextMenuItem = {
    onClick: () => {
      dialogActions.open("newItem", {});
      close();
    },
    view: <TextWithIcon icon={FilePlusIcon}>New File or Folder</TextWithIcon>,
  };

  // Tag-related menu items
  const assignTagsItem: ContextMenuItem = {
    onClick: () => {
      directoryHelpers.openAssignTagsDialog(fullPath, tableData, directoryId);
      close();
    },
    view: <TextWithIcon icon={TagIcon}>Assign Tags...</TextWithIcon>,
  };

  const copyPathItem: ContextMenuItem = {
    onClick: () => {
      navigator.clipboard.writeText(fullPath);
      toast.show({
        severity: "success",
        message: "Path copied to clipboard",
        customIcon: ClipboardCopyIcon,
      });
    },
    view: <TextWithIcon icon={ClipboardCopyIcon}>Copy Path</TextWithIcon>,
  };

  // Archive selected files/folders
  const archiveItem: ContextMenuItem = {
    onClick: () => {
      const filePaths = selectedItems.map(
        (i) => i.fullPath ?? directoryHelpers.getFullPath(i.name, directoryId),
      );
      // If single item, suggest its name (without extension for files)
      let suggestedName: string | undefined;
      if (selectedItems.length === 1) {
        const singleItem = selectedItems[0];
        if (singleItem.type === "file") {
          // Remove extension
          suggestedName = singleItem.name.replace(/\.[^.]+$/, "");
        } else {
          // For folders, use the folder name
          suggestedName = singleItem.name;
        }
      }
      dialogActions.open("archive", { filePaths, suggestedName });
      close();
    },
    view: (
      <TextWithIcon icon={FileArchiveIcon}>
        Create Archive
        {isSelected && selectionIndexes.size > 1
          ? ` (${selectionIndexes.size} items)`
          : ""}
      </TextWithIcon>
    ),
  };

  const unarchiveMetadata =
    item.type === "file" && ArchiveHelpers.getUnarchiveMetadata(fullPath);

  const unarchiveItem: ContextMenuItem | null = unarchiveMetadata
    ? {
        onClick: () => {
          dialogActions.open("unarchive", unarchiveMetadata);
          close();
        },
        view: (
          <TextWithIcon icon={FolderInputIcon}>Extract Archive</TextWithIcon>
        ),
      }
    : null;

  // Last used tag quick-add item
  const lastUsedTag = useSelector(tagsStore, selectLastUsedTag);
  const hasLastUsedTag = lastUsedTag
    ? useSelector(tagsStore, selectHasTag(fullPath, lastUsedTag))
    : false;
  const lastUsedTagName = lastUsedTag
    ? useSelector(tagsStore, selectTagName(lastUsedTag))
    : "";

  const lastUsedTagItem: ContextMenuItem | null =
    lastUsedTag && !hasLastUsedTag
      ? {
          onClick: () => {
            tagsStore.send({
              type: "addTagToFiles",
              fullPaths: selectedItems.map(
                (i) =>
                  i.fullPath ??
                  directoryHelpers.getFullPath(i.name, directoryId),
              ),
              color: lastUsedTag!,
            });

            close();
          },
          view: (
            <div className="flex items-center gap-2">
              <span
                className={`size-3 rounded-full ${TAG_COLOR_CLASSES[lastUsedTag!].dot}`}
              />
              <span>Add to "{lastUsedTagName}"</span>
            </div>
          ),
        }
      : null;

  // Open with Application menu item (only for files)
  const [applications, setApplications] = useState<ApplicationInfo[]>([]);

  useEffect(() => {
    if (item.type === "file") {
      getWindowElectron()
        .getApplicationsForFile(fullPath)
        .then(setApplications)
        .catch(() => setApplications([]));
    }
  }, [item.type, fullPath]);

  const openWithApplicationItem: ContextMenuItem | null =
    item.type === "file"
      ? {
          view: <TextWithIcon icon={ExternalLinkIcon}>Open With</TextWithIcon>,
          submenu: applications.map((app) => ({
            onClick: async () => {
              try {
                await getWindowElectron().openFileWithApplication(
                  fullPath,
                  app.path,
                );
              } catch (err: any) {
                toast.show({
                  severity: "error",
                  message: `Failed to open file: ${err?.message || "Unknown error"}`,
                });
              }
              close();
            },
            view: (
              <span>
                {app.name}
                {app.isDefault ? " (Default)" : ""}
              </span>
            ),
          })),
        }
      : null;

  const filteredCommands = windowArgs.commands?.filter(
    (c) => !c.glob || checkGlob(c.glob, fullPath),
  );

  const inMenuCommands = filteredCommands?.filter((c) => {
    return !c.menu || c.menu?.placement === "menu";
  });

  if (inMenuCommands?.length) {
    inMenuCommands.sort(
      (a, b) => (a.menu?.priority ?? 0) - (b.menu?.priority ?? 0),
    );
  }

  const inlineCommands = filteredCommands?.filter((c) => {
    return c.menu?.placement === "inline";
  });

  if (inlineCommands?.length) {
    inlineCommands.sort(
      (a, b) => (a.menu?.priority ?? 0) - (b.menu?.priority ?? 0),
    );
  }

  const commandItem: ContextMenuItem | null = inMenuCommands?.length
    ? {
        view: <TextWithIcon icon={TerminalIcon}>Run Command</TextWithIcon>,
        submenu: inMenuCommands.map((script) => ({
          onClick: () => CommandHelpers.runCommand(script, fullPath, item),
          view: script.name,
        })),
      }
    : null;

  const inlineCommandItems = inlineCommands?.map((script) => ({
    onClick: () => CommandHelpers.runCommand(script, fullPath, item),
    view: <TextWithIcon icon={TerminalIcon}>{script.name}</TextWithIcon>,
  }));

  const selectItem: ContextMenuItem | null = windowArgs.isSelectAppMode
    ? {
        view: <TextWithIcon icon={BoxSelectIcon}>Select</TextWithIcon>,
        onClick: () => getWindowElectron().sendSelectAppResult(fullPath),
      }
    : null;

  if (item.type === "dir") {
    const openDirectoryInNewTab: ContextMenuItem = {
      onClick: () => {
        directoryHelpers.openFolderInNewTab(item, directoryId);
      },
      view: <TextWithIcon icon={FolderPlusIcon}>Open in new tab</TextWithIcon>,
    };

    const loadDirectorySize: ContextMenuItem = {
      onClick: () => {
        directoryHelpers.loadDirectorySizes(directoryId, item.name);
        close();
      },
      view: (
        <TextWithIcon icon={HardDriveIcon}>Calculate folder size</TextWithIcon>
      ),
    };

    const directoryMenuItems: (ContextMenuItem | null)[] = [
      ...(inlineCommandItems || []),
      openDirectoryInNewTab,
      { isSeparator: true },
      {
        onClick: () => {
          setDefaultPath(fullPath);
          close();
        },
        view: (
          <TextWithIcon icon={FolderCogIcon}>Set as default path</TextWithIcon>
        ),
      },
      favoriteItem,
      lastUsedTagItem,
      assignTagsItem,
      { isSeparator: true },
      copyItem,
      cutItem,
      pasteItem,
      renameItem,
      batchRenameItem,
      deleteItem,
      { isSeparator: true },
      archiveItem,
      { isSeparator: true },
      newFileItem,
      { isSeparator: true },
      copyPathItem,
      loadDirectorySize,
      { isSeparator: true },
      commandItem,
      selectItem,
    ];

    return <ContextMenuList items={directoryMenuItems} />;
  }

  const fileMenuItems: (ContextMenuItem | null)[] = [
    ...(inlineCommandItems || []),
    openWithApplicationItem,
    { isSeparator: true },
    favoriteItem,
    lastUsedTagItem,
    assignTagsItem,
    { isSeparator: true },
    copyItem,
    cutItem,
    pasteItem,
    deleteItem,
    renameItem,
    batchRenameItem,
    { isSeparator: true },
    archiveItem,
    unarchiveItem,
    { isSeparator: true },
    newFileItem,
    { isSeparator: true },
    copyPathItem,
    { isSeparator: true },
    commandItem,
    selectItem,
  ];

  return <ContextMenuList items={fileMenuItems} />;
};
