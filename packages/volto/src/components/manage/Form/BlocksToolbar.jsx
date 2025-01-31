import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { messages } from '@plone/volto/helpers/MessageLabels/MessageLabels';
import {
  getBlocksFieldname,
  getBlocksLayoutFieldname,
} from '@plone/volto/helpers/Blocks/Blocks';
import Icon from '@plone/volto/components/theme/Icon/Icon';
import { Plug } from '@plone/volto/components/manage/Pluggable';
import { v4 as uuid } from 'uuid';
import { load } from 'redux-localstorage-simple';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import without from 'lodash/without';

import {
  setBlocksClipboard,
  resetBlocksClipboard,
} from '@plone/volto/actions/blocksClipboard/blocksClipboard';
import config from '@plone/volto/registry';

import copySVG from '@plone/volto/icons/copy.svg';
import cutSVG from '@plone/volto/icons/cut.svg';
import pasteSVG from '@plone/volto/icons/paste.svg';
import trashSVG from '@plone/volto/icons/delete.svg';
import { cloneBlocks } from '@plone/volto/helpers/Blocks/cloneBlocks';

export class BlocksToolbarComponent extends React.Component {
  constructor(props) {
    super(props);

    this.copyBlocksToClipboard = this.copyBlocksToClipboard.bind(this);
    this.cutBlocksToClipboard = this.cutBlocksToClipboard.bind(this);
    this.deleteBlocks = this.deleteBlocks.bind(this);
    this.loadFromStorage = this.loadFromStorage.bind(this);
    this.pasteBlocks = this.pasteBlocks.bind(this);
    this.setBlocksClipboard = this.setBlocksClipboard.bind(this);
  }

  loadFromStorage() {
    const clipboard = load({ states: ['blocksClipboard'] })?.blocksClipboard;
    if (!isEqual(clipboard, this.props.blocksClipboard))
      this.props.setBlocksClipboard(clipboard || {});
  }

  componentDidMount() {
    window.addEventListener('storage', this.loadFromStorage, true);
  }

  componentWillUnmount() {
    window.removeEventListener('storage', this.loadFromStorage);
  }

  deleteBlocks() {
    const blockIds = this.props.selectedBlocks;

    const { formData } = this.props;
    const blocksFieldname = getBlocksFieldname(formData);
    const blocksLayoutFieldname = getBlocksLayoutFieldname(formData);

    // Might need ReactDOM.unstable_batchedUpdates()
    this.props.onSelectBlock(null);
    const newBlockData = {
      [blocksFieldname]: omit(formData[blocksFieldname], blockIds),
      [blocksLayoutFieldname]: {
        ...formData[blocksLayoutFieldname],
        items: without(formData[blocksLayoutFieldname].items, ...blockIds),
      },
    };
    this.props.onChangeBlocks(newBlockData);
  }

  copyBlocksToClipboard() {
    this.setBlocksClipboard('copy');
  }

  cutBlocksToClipboard() {
    this.setBlocksClipboard('cut');
    this.deleteBlocks();
  }

  setBlocksClipboard(actionType) {
    const { formData } = this.props;
    const blocksFieldname = getBlocksFieldname(formData);
    const blocks = formData[blocksFieldname];
    const blocksData = this.props.selectedBlocks
      .map((blockId) => [blockId, blocks[blockId]])
      .filter(([blockId]) => !!blockId); // Removes null blocks
    this.props.setBlocksClipboard({ [actionType]: blocksData });
    this.props.onSetSelectedBlocks([]);
  }

  pasteBlocks(e) {
    const { formData, blocksClipboard = {}, selectedBlock } = this.props;
    const mode = Object.keys(blocksClipboard).includes('cut') ? 'cut' : 'copy';
    const blocksData = blocksClipboard[mode] || [];
    const cloneWithIds = blocksData
      .filter(([blockId, blockData]) => blockId && !!blockData['@type']) // Removes null blocks
      .map(([blockId, blockData]) => {
        const blockConfig = config.blocks.blocksConfig[blockData['@type']];
        return mode === 'copy'
          ? blockConfig.cloneData
            ? blockConfig.cloneData(blockData)
            : [uuid(), cloneBlocks(blockData)]
          : [blockId, blockData]; // if cut/pasting blocks, we don't clone
      })
      .filter((info) => !!info); // some blocks may refuse to be copied
    const blocksFieldname = getBlocksFieldname(formData);
    const blocksLayoutFieldname = getBlocksLayoutFieldname(formData);
    const selectedIndex =
      formData[blocksLayoutFieldname].items.indexOf(selectedBlock) + 1;

    const newBlockData = {
      [blocksFieldname]: {
        ...formData[blocksFieldname],
        ...Object.assign(
          {},
          ...cloneWithIds.map(([id, data]) => ({ [id]: data })),
        ),
      },
      [blocksLayoutFieldname]: {
        ...formData[blocksLayoutFieldname],
        items: [
          ...formData[blocksLayoutFieldname].items.slice(0, selectedIndex),
          ...cloneWithIds.map(([id]) => id),
          ...formData[blocksLayoutFieldname].items.slice(selectedIndex),
        ],
      },
    };

    if (!(e.ctrlKey || e.metaKey)) this.props.resetBlocksClipboard();
    this.props.onChangeBlocks(newBlockData);
  }

  render() {
    const {
      blocksClipboard = {},
      selectedBlock,
      selectedBlocks,
      intl,
    } = this.props;
    return (
      <>
        {selectedBlocks.length > 0 ? (
          <>
            <Plug pluggable="main.toolbar.bottom" id="blocks-delete-btn">
              <button
                aria-label={intl.formatMessage(messages.deleteBlocks)}
                onClick={this.deleteBlocks}
                tabIndex={0}
                className="deleteBlocks"
                id="toolbar-delete-blocks"
              >
                <Icon name={trashSVG} size="30px" />
              </button>
            </Plug>
            <Plug pluggable="main.toolbar.bottom" id="blocks-cut-btn">
              <button
                aria-label={intl.formatMessage(messages.cutBlocks)}
                onClick={this.cutBlocksToClipboard}
                tabIndex={0}
                className="cutBlocks"
                id="toolbar-cut-blocks"
              >
                <Icon name={cutSVG} size="30px" />
              </button>
            </Plug>
            <Plug pluggable="main.toolbar.bottom" id="blocks-copy-btn">
              <button
                aria-label={intl.formatMessage(messages.copyBlocks)}
                onClick={this.copyBlocksToClipboard}
                tabIndex={0}
                className="copyBlocks"
                id="toolbar-copy-blocks"
              >
                <Icon name={copySVG} size="30px" />
              </button>
            </Plug>
          </>
        ) : (
          ''
        )}
        {selectedBlock && (blocksClipboard?.cut || blocksClipboard?.copy) && (
          <Plug
            pluggable="main.toolbar.bottom"
            id="block-paste-btn"
            dependencies={[selectedBlock]}
          >
            <button
              aria-label={intl.formatMessage(messages.pasteBlocks)}
              onClick={this.pasteBlocks}
              tabIndex={0}
              className="pasteBlocks"
              id="toolbar-paste-blocks"
            >
              <span className="blockCount">
                {(blocksClipboard.cut || blocksClipboard.copy).length}
              </span>
              <Icon name={pasteSVG} size="30px" />
            </button>
          </Plug>
        )}
      </>
    );
  }
}

export default compose(
  injectIntl,
  connect(
    (state) => {
      return {
        blocksClipboard: state?.blocksClipboard || {},
      };
    },
    { setBlocksClipboard, resetBlocksClipboard },
  ),
)(BlocksToolbarComponent);
